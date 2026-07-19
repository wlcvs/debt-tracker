import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/importers/base", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/importers/base")>();
  return { ...actual, extractPages: vi.fn() };
});

import { extractPages, type PdfPage } from "@/lib/importers/base";
import { parse, parseShortDate } from "@/lib/importers/nubank";
import type { PdfLine } from "@/lib/pdf/group-lines";

const mockExtractPages = vi.mocked(extractPages);

/** Conta-corrente path only inspects page.text, so lines can be empty. */
function ccPage(text: string): PdfPage {
  return { text, lines: [], width: 600 };
}

/** Cartão path only inspects page.lines (via lineText); build one item per row
 * with the exact target string, sidestepping groupLines' column-gap logic. */
function cardLine(str: string, y: number): PdfLine {
  return { y, items: [{ str, transform: [1, 0, 0, 1, 0, y] }] };
}

function cardPage(text: string, lines: PdfLine[]): PdfPage {
  return { text, lines, width: 600 };
}

describe("nubank.parse — conta corrente (Movimentações present)", () => {
  it("a date-header line containing 'Total de' sets currentDate and a following line becomes a transaction", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage("Movimentações\n01 MAI 2026 Total de saídas - 92,49\nCompra no débito 45,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-01", description: "Compra no débito", amount: 45 }]);
  });

  it("a header-shaped line WITHOUT 'Total de' does not set currentDate, so a following transaction line is dropped", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage("Movimentações\n01 MAI 2026 Saldo em conta\nCompra no débito 45,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("skips lines starting with a CC_SKIP prefix ('CPF') even when a date is already set", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nCPF do titular 999.999.999-99 45,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("skips lines starting with another CC_SKIP prefix ('Saldo inicial')", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage("Movimentações\n01 MAI 2026 Total de saídas - 92,49\nSaldo inicial 1.000,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("strips a masked-account suffix from the description via cleanCcDesc", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nPix enviado - •.123.456-•• 50,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-01", description: "Pix enviado", amount: 50 }]);
  });

  it("strips a CNPJ suffix from the description via cleanCcDesc", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nPagamento boleto - 12.345.678/0001-99 120,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-01", description: "Pagamento boleto", amount: 120 }]);
  });

  it("strips a trailing location/annotation suffix from the description via cleanCcDesc", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nCompra Loja - SP Some Place(123) 30,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-01", description: "Compra Loja", amount: 30 }]);
  });

  it("strips a trailing ALL-CAPS suffix from the description via cleanCcDesc", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nCompra Mercado - SP 22,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-01", description: "Compra Mercado", amount: 22 }]);
  });

  it("rejects an amount of 0,00", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage("Movimentações\n01 MAI 2026 Total de saídas - 92,49\nAjuste de saldo 0,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("drops the transaction silently when the cleaned description ends up empty", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage(
        "Movimentações\n01 MAI 2026 Total de saídas - 92,49\n- •.123.456-•• 20,00"
      ),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("accumulates multiple valid transactions across multiple pages", async () => {
    mockExtractPages.mockResolvedValue([
      ccPage("Movimentações\n01 MAI 2026 Total de saídas - 92,49\nCompra A 10,00"),
      ccPage("02 MAI 2026 Total de saídas - 15,00\nCompra B 15,00"),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([
      { date: "2026-05-01", description: "Compra A", amount: 10 },
      { date: "2026-05-02", description: "Compra B", amount: 15 },
    ]);
  });
});

describe("nubank.parse — cartão (fatura, no Movimentações)", () => {
  it("matches CARD_TX_RE and parses date/description/amount", async () => {
    mockExtractPages.mockResolvedValue([
      cardPage("Fatura 2026", [cardLine("04 MAI •••• 8119 Uber *Trip R$ 23,50", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2026-05-04", description: "Uber *Trip", amount: 23.5 }]);
  });

  it("skips a line containing 'IOF de' even if it superficially matches CARD_TX_RE", async () => {
    mockExtractPages.mockResolvedValue([
      cardPage("Fatura 2026", [cardLine("04 MAI •••• 8119 IOF de financiamento R$ 5,91", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("rejects an amount of 0,00 (must be strictly > 0)", async () => {
    mockExtractPages.mockResolvedValue([
      cardPage("Fatura 2026", [cardLine("04 MAI •••• 8119 Estorno R$ 0,00", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });

  it("detects the year only from the first 3 pages, ignoring a year found on page 4", async () => {
    mockExtractPages.mockResolvedValue([
      cardPage("Fatura 2025", []),
      cardPage("", []),
      cardPage("", []),
      cardPage("2030", [cardLine("04 MAI •••• 8119 Compra R$ 10,00", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([{ date: "2025-05-04", description: "Compra", amount: 10 }]);
  });

  it("returns [] and does not crash on plausible but non-Nubank text with no matching lines", async () => {
    mockExtractPages.mockResolvedValue([
      cardPage("Some random unrelated PDF content 123 456", []),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });
});

describe("nubank.parse — routing", () => {
  it("routes a page containing 'Movimentações' to parseContaCorrente even alongside a R$-formatted line", async () => {
    // This line matches CARD_TX_RE (would produce a transaction under the cartão
    // path) but, since the page text contains "Movimentações", it's routed to
    // parseContaCorrente instead — which requires a date-header line first, so
    // with none present here, nothing is emitted.
    mockExtractPages.mockResolvedValue([
      cardPage("Movimentações", [cardLine("04 MAI •••• 8119 Uber *Trip R$ 23,50", 100)]),
    ]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });
});

describe("nubank.parse — empty input", () => {
  it("returns [] for an empty pages array", async () => {
    mockExtractPages.mockResolvedValue([]);

    const txns = await parse(Buffer.from(""));

    expect(txns).toEqual([]);
  });
});

describe("parseShortDate", () => {
  it("parses a 'dd MMM' short date against a given year", () => {
    expect(parseShortDate("04 MAI", 2026)).toBe("2026-05-04");
  });

  it("returns null for an unrecognized month abbreviation", () => {
    expect(parseShortDate("04 XXX", 2026)).toBeNull();
  });

  it("returns null when fewer than 2 whitespace-separated parts are given", () => {
    expect(parseShortDate("04", 2026)).toBeNull();
  });
});
