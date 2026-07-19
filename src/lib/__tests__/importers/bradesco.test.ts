import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExtractTextPages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/importers/base", async () => {
  const actual = await vi.importActual<typeof import("@/lib/importers/base")>("@/lib/importers/base");
  return { ...actual, extractTextPages: mockExtractTextPages };
});

import { parse } from "@/lib/importers/bradesco";

beforeEach(() => {
  vi.clearAllMocks();
});

function setPages(...lines: string[]): void {
  mockExtractTextPages.mockResolvedValue([lines.join("\n")]);
}

// Discriminator helper: sandwiches `lineToTest` between a date line that sets
// currentDate without recording a transaction, and a continuation "doc number"
// line that records a transaction using whatever pendingType was left behind.
// If `lineToTest` is correctly dropped, pendingType stays "" and the resulting
// description falls back to "Transaction". If it "leaks through" (not
// recognized as SKIP/DETAIL), it becomes pendingType and shows up as the
// description instead.
async function pendingTypeAfter(lineToTest: string) {
  setPages("01/02/2026 PIX RECEBIDO", lineToTest, "123 100,00 50,00");
  return parse(Buffer.from(""));
}

describe("bradesco.parse", () => {
  it("returns [] for empty input", async () => {
    mockExtractTextPages.mockResolvedValue([]);
    expect(await parse(Buffer.from(""))).toEqual([]);
  });

  // ── SKIP_STARTS ──────────────────────────────────────────────────────────

  describe("SKIP_STARTS lines are dropped", () => {
    it.each([
      "Bradesco Extrato de Conta Corrente",
      "Data Histórico Docto Valor Saldo",
      "Nome: Fulano de Tal",
      "Total do período",
      "Extrato de: 01/01/2026 a 31/01/2026",
      "Data: 01/02/2026",
    ])("drops %s", async (line) => {
      const txns = await pendingTypeAfter(line);
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe("Transaction");
    });
  });

  // ── SKIP_CONTAINS ────────────────────────────────────────────────────────

  it("drops SKIP_CONTAINS lines (e.g. containing 'Movimentação entre')", async () => {
    const txns = await pendingTypeAfter("Movimentação entre 01/01/2026 e 31/01/2026");
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Transaction");
  });

  // ── DETAIL_STARTS ────────────────────────────────────────────────────────

  describe("DETAIL_STARTS lines are dropped", () => {
    it.each(["CONTR 123456789", "Folha:1"])("drops %s", async (line) => {
      const txns = await pendingTypeAfter(line);
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe("Transaction");
    });
  });

  // ── DES:/REM: append to last transaction ────────────────────────────────

  describe("DES:/REM: prefixed lines", () => {
    it("appends extra description to the LAST pushed transaction, stripping a trailing dd/mm", async () => {
      setPages("01/02/2026 COMPRA 100,00 50,00", "DES:LOJA XYZ 01/02");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe("COMPRA - LOJA XYZ");
    });

    it("REM: behaves the same way as DES:", async () => {
      setPages("01/02/2026 COMPRA 100,00 50,00", "REM:JOAO DA SILVA 03/02");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe("COMPRA - JOAO DA SILVA");
    });

    it("is a silent no-op when there is no transaction yet (no crash, nothing created)", async () => {
      setPages("DES:SOME TEXT 01/02");
      const txns = await parse(Buffer.from(""));
      expect(txns).toEqual([]);
    });
  });

  // ── REMET. ───────────────────────────────────────────────────────────────

  describe("REMET. prefixed lines", () => {
    it("appends the sender name to the last transaction's description when last.base is truthy", async () => {
      setPages("01/02/2026 TED RECEBIDA 100,00 50,00", "REMET.JOSE DA SILVA");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      // last.base ("TED RECEBIDA") is truthy, so desc becomes "base - rest",
      // never the raw-line fallback (base is always non-empty in practice,
      // since add() defaults an empty pendingType to the literal "Transaction" —
      // the `last.base` falsy branch in source is effectively unreachable
      // through the public parse() API).
      expect(txns[0].description).toBe("TED RECEBIDA - JOSE DA SILVA");
    });
  });

  // ── Full date line recording ────────────────────────────────────────────

  describe("full date lines (dd/mm/yyyy + rest)", () => {
    it("records a transaction when the line has >= 2 amounts, using the FIRST amount", async () => {
      setPages("15/03/2026 COMPRA CARTAO 250,00 1.000,00");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      expect(txns[0]).toMatchObject({ date: "2026-03-15", amount: 250 });
    });

    it("does NOT record a transaction when the line has only 1 amount (expects a continuation)", async () => {
      setPages("15/03/2026 COMPRA CARTAO 250,00");
      const txns = await parse(Buffer.from(""));
      expect(txns).toEqual([]);
    });
  });

  // ── Doc-number continuation lines ───────────────────────────────────────

  it("a non-date doc-number continuation line (digits+space, >=2 amounts) creates a transaction reusing currentDate/pendingType", async () => {
    setPages("15/03/2026 COMPRA CARTAO", "PARCELA 2/3", "789012 250,00 1.000,00");
    const txns = await parse(Buffer.from(""));
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ date: "2026-03-15", description: "PARCELA 2/3", amount: 250 });
  });

  // ── Amount threshold ─────────────────────────────────────────────────────

  it("rejects amounts below 0.05", async () => {
    setPages("15/03/2026 TAXA 0,04 0,04");
    const txns = await parse(Buffer.from(""));
    expect(txns).toEqual([]);
  });

  // ── pendingType from unrecognized lines ─────────────────────────────────

  it("treats any unrecognized non-skip line as the pendingType for the NEXT transaction's description", async () => {
    setPages("15/03/2026 SEM VALOR", "PIX ENVIADO", "456789 30,00 20,00");
    const txns = await parse(Buffer.from(""));
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("PIX ENVIADO");
  });
});
