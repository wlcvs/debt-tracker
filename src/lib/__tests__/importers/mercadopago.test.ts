import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExtractTextPages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/importers/base", async () => {
  const actual = await vi.importActual<typeof import("@/lib/importers/base")>("@/lib/importers/base");
  return { ...actual, extractTextPages: mockExtractTextPages };
});

import { parse } from "@/lib/importers/mercadopago";

beforeEach(() => {
  vi.clearAllMocks();
});

function setPages(...lines: string[]): void {
  mockExtractTextPages.mockResolvedValue([lines.join("\n")]);
}

describe("mercadopago.parse", () => {
  it("returns [] for empty input", async () => {
    mockExtractTextPages.mockResolvedValue([]);
    expect(await parse(Buffer.from(""))).toEqual([]);
  });

  // ── TX_RE anchoring ──────────────────────────────────────────────────────

  describe("TX_RE requires an exact 'dd/mm description R$ amount' shape", () => {
    it("matches a clean transaction line", async () => {
      setPages("Vencimento 15/05/2026", "08/06 SUPERMERCADO PORTO SEG R$ 195,23");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      expect(txns[0].amount).toBe(195.23);
    });

    it("does NOT match when there is extra trailing text after the amount", async () => {
      setPages("Vencimento 15/05/2026", "08/06 SUPERMERCADO PORTO SEG R$ 195,23 PARCELA 1/1");
      const txns = await parse(Buffer.from(""));
      expect(txns).toEqual([]);
    });
  });

  // ── SKIP list ────────────────────────────────────────────────────────────

  describe("SKIP substrings are dropped", () => {
    // Each of these lines is deliberately shaped to ALSO match TX_RE
    // (dd/mm description R$ amount), so the test actually exercises the
    // SKIP.some(includes) short-circuit rather than relying on the regex
    // failing to match anyway.
    it.each([
      "01/01 Pagamento da fatura R$ 10,00",
      "01/01 Data Movimentações R$ 10,00",
      "01/01 Movimentações na fatura R$ 10,00",
      "01/01 Detalhes de consumo R$ 10,00",
      "01/01 Total R$ 10,00",
      "01/01 Cartão Visa R$ 10,00",
      "01/01 Cartão Mastercard R$ 10,00",
      "01/01 Cartão Elo R$ 10,00",
    ])("drops line containing a SKIP substring: %s", async (line) => {
      setPages(line, "08/06 SUPERMERCADO PORTO SEG R$ 195,23");
      const txns = await parse(Buffer.from(""));
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe("SUPERMERCADO PORTO SEG");
    });
  });

  // ── Amount must be > 0 ───────────────────────────────────────────────────

  it("rejects a zero amount (0,00)", async () => {
    setPages("08/06 ESTORNO R$ 0,00");
    const txns = await parse(Buffer.from(""));
    expect(txns).toEqual([]);
  });

  // ── Year detection ───────────────────────────────────────────────────────

  describe("year detection", () => {
    it("uses the year found via 'Emitida em dd/mm/yyyy'", async () => {
      setPages("Emitida em 01/04/2026", "22/04 MP*CARLOSJORGEMA Parcela 2 de 3 R$ 111,23");
      const txns = await parse(Buffer.from(""));
      expect(txns[0].date).toBe("2026-04-22");
    });

    it("uses the year found via 'Vencimento dd/mm/yyyy'", async () => {
      setPages("Vencimento 10/07/2026", "08/06 SUPERMERCADO PORTO SEG R$ 195,23");
      const txns = await parse(Buffer.from(""));
      expect(txns[0].date).toBe("2026-06-08");
    });

    it("falls back to the current year when no YEAR_RE match is present", async () => {
      setPages("08/06 SUPERMERCADO PORTO SEG R$ 195,23");
      const txns = await parse(Buffer.from(""));
      expect(txns[0].date.slice(0, 4)).toBe(String(new Date().getFullYear()));
    });
  });

  // ── Fixture-derived regression pins ──────────────────────────────────────

  describe("fixture-derived regression cases", () => {
    it('parses "22/04 MP*CARLOSJORGEMA Parcela 2 de 3 R$ 111,23"', async () => {
      setPages("Emitida em 01/04/2026", "22/04 MP*CARLOSJORGEMA Parcela 2 de 3 R$ 111,23");
      const txns = await parse(Buffer.from(""));
      expect(txns).toEqual([
        { date: "2026-04-22", description: "MP*CARLOSJORGEMA Parcela 2 de 3", amount: 111.23 },
      ]);
    });

    it('parses "08/06 SUPERMERCADO PORTO SEG R$ 195,23"', async () => {
      setPages("Emitida em 01/04/2026", "08/06 SUPERMERCADO PORTO SEG R$ 195,23");
      const txns = await parse(Buffer.from(""));
      expect(txns).toEqual([
        { date: "2026-06-08", description: "SUPERMERCADO PORTO SEG", amount: 195.23 },
      ]);
    });
  });
});
