import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/importers/base", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/importers/base")>();
  return { ...actual, extractPages: vi.fn() };
});

import { extractPages, type PdfPage } from "@/lib/importers/base";
import { parse } from "@/lib/importers/itau";
import type { PdfLine } from "@/lib/pdf/group-lines";

const mockExtractPages = vi.mocked(extractPages);

/** parseFatura/parseTextFallback only inspect page.text. */
function textPage(text: string): PdfPage {
  return { text, lines: [], width: 600 };
}

/** parseTables only inspects page.lines (via lineText); one item per row with
 * the exact target string sidesteps groupLines' column-gap logic. */
function tableLine(str: string, y: number): PdfLine {
  return { y, items: [{ str, transform: [1, 0, 0, 1, 0, y] }] };
}

function tablePage(text: string, lines: PdfLine[]): PdfPage {
  return { text, lines, width: 600 };
}

describe("itau.parse — fatura (DATA + ESTABELECIMENTO section)", () => {
  it("enters the transaction section on a header line containing both DATA and ESTABELECIMENTO", async () => {
    mockExtractPages.mockResolvedValue([
      textPage("2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA CARTAO 150,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA CARTAO", amount: 150 }]);
  });

  it("closes the section (with flush) on a line matching STOP_SECTION_RE after whitespace-stripping", async () => {
    mockExtractPages.mockResolvedValue([
      textPage(
        "2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA CARTAO 150,00\nTotal dos lançamentos 150,00\n13/06 OUTRA COMPRA 99,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    // The pending 12/06 transaction is flushed by the stop line; the 13/06 line
    // arrives after the section closed (inTxSection is false) so it's ignored.
    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA CARTAO", amount: 150 }]);
  });

  it("a line starting with dd/mm begins a new pending transaction, flushing any previous pending one first", async () => {
    mockExtractPages.mockResolvedValue([
      textPage(
        "2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA UM 150,00\n13/06 COMPRA DOIS 80,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([
      { date: "2026-06-12", description: "COMPRA UM", amount: 150 },
      { date: "2026-06-13", description: "COMPRA DOIS", amount: 80 },
    ]);
  });

  it("appends an ALL-CAPS continuation line (no amount of its own) to pendingDesc", async () => {
    // pendingAmount is only ever set from the dd/mm-starting line itself —
    // continuation lines only ever contribute to the description, never the
    // amount — so the amount here (150,00) must come from the first line.
    mockExtractPages.mockResolvedValue([
      textPage(
        "2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA 150,00\nCONTINUACAO"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA CONTINUACAO", amount: 150 }]);
  });

  it("does NOT append a continuation line containing a lowercase word", async () => {
    mockExtractPages.mockResolvedValue([
      textPage(
        "2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA 150,00\nlowercase junk here"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    // "lowercase" is the first word and already contains a-z, so the scan
    // stops immediately — no words get appended and pendingDesc stays "COMPRA".
    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA", amount: 150 }]);
  });

  it("does NOT append a continuation line's words at/after a full BR amount token", async () => {
    mockExtractPages.mockResolvedValue([
      textPage(
        "2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA 150,00\nEXTRA 200,00 MAIS"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    // Word-by-word scan stops at the first word matching AMOUNT_FULL_RE
    // ("200,00"), so only "EXTRA" (before it) is appended, and the original
    // amount (150,00, from the first line) is unaffected by the continuation's
    // own amount-shaped word.
    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA EXTRA", amount: 150 }]);
  });

  it("flushes any still-pending transaction at the end of a page", async () => {
    mockExtractPages.mockResolvedValue([
      textPage("2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA FINAL 150,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA FINAL", amount: 150 }]);
  });

  it("drops a pending transaction with no amount at flush time", async () => {
    mockExtractPages.mockResolvedValue([
      textPage("2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA SEM VALOR"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("drops a pending transaction whose amount resolves to 0", async () => {
    mockExtractPages.mockResolvedValue([
      textPage("2026\nDATA ESTABELECIMENTO VALOR\n12/06 COMPRA ZERO 0,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("re-detects the year per page: page 1 uses 2025, page 2 uses 2026", async () => {
    mockExtractPages.mockResolvedValue([
      textPage("2025\nDATA ESTABELECIMENTO VALOR\n10/01 COMPRA A 10,00"),
      textPage("2026\nDATA ESTABELECIMENTO VALOR\n10/01 COMPRA B 20,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([
      { date: "2025-01-10", description: "COMPRA A", amount: 10 },
      { date: "2026-01-10", description: "COMPRA B", amount: 20 },
    ]);
  });
});

describe("itau.parse — rowToTransaction via parseTables", () => {
  it("prefers the D-suffixed amount over other amounts in the row", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("no year marker here", [
        tableLine("12/06/2026 COMPRA CARTAO 150,00 D 1.850,00", 100),
      ]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([
      { date: "2026-06-12", description: "COMPRA CARTAO", amount: 150 },
    ]);
  });

  it("does NOT negate the amount for a C (credit) suffix — used as a plain positive value", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("no year marker here", [
        tableLine("12/06/2026 ESTORNO 150,00 C 1.850,00", 100),
      ]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns[0].amount).toBe(150);
  });

  it("falls back to the LAST amount found when there's no D/C suffix", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("no year marker here", [
        tableLine("12/06/2026 COMPRA PARCELADA 10,00 20,00 30,00", 100),
      ]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns[0].amount).toBe(30);
  });

  it("returns null (no transaction) for a row with no date-slash match", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("no year marker here", [tableLine("COMPRA SEM DATA 150,00", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("cleans description of date/amount/D-C tokens", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("no year marker here", [
        tableLine("12/06/2026 COMPRA CARTAO 150,00 D 1.850,00", 100),
      ]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns[0].description).toBe("COMPRA CARTAO");
  });
});

describe("itau.parse — 3-tier fallback cascade", () => {
  it("falls through to parseTextFallback when parseTables (empty lines) yields zero rows", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("12/06/2026 COMPRA FALLBACK 150,00 D 1.850,00", []),
    ]);

    const txns = await parse(Buffer.from(""));

    // parseTables sees no lines at all -> 0 rows -> parse() falls back to
    // parseTextFallback, which reads page.text instead.
    expect(txns).toEqual([{ date: "2026-06-12", description: "COMPRA FALLBACK", amount: 150 }]);
  });

  it("uses parseTables' result directly when it yields at least one row, without touching parseTextFallback's text", async () => {
    mockExtractPages.mockResolvedValue([
      tablePage("12/06/2026 SHOULD NOT BE USED 999,00 D 1.850,00", [
        tableLine("12/06/2026 FROM TABLE 150,00 D 1.850,00", 100),
      ]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-06-12", description: "FROM TABLE", amount: 150 }]);
  });
});

describe("itau.parse — empty input", () => {
  it("returns [] for an empty pages array", async () => {
    mockExtractPages.mockResolvedValue([]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });
});
