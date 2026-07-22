import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { transactionRows, cleanRows, extract } from "@/lib/LLM-extract/itau";
import * as ollamaClient from "@/lib/LLM-extract/ollama-client";
import * as importersBase from "@/lib/importers/base";
import type { PdfPage } from "@/lib/importers/base";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function fixture(name: string): Buffer | null {
  const p = path.join(FIXTURES_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Builds a mocked extractPages() page whose left column (x=0, always below
 * the 60%-width split) is `rowTexts` joined one row per line — each row is a
 * single PdfTextItem so lineText() returns it verbatim (no gap-reconstruction
 * ambiguity to worry about in these tests).
 */
function mockPage(rowTexts: string[], width = 1000): PdfPage {
  const lines = rowTexts.map((str, i) => ({
    y: 1000 - i * 10,
    items: [{ str, transform: [1, 0, 0, 1, 0, 1000 - i * 10], width: str.length * 6 }],
  }));
  return { text: rowTexts.join("\n"), lines, width };
}

describe("transactionRows (real PDF)", () => {
  it("isolates the DATA/ESTABELECIMENTO left column and stops at totals", async () => {
    const data = fixture("Fatura_Itau_20260629-180424.pdf");
    if (!data) return;

    const text = await transactionRows(data);
    expect(text).toContain("DATA");
    expect(text).toContain("ESTABELECIMENTO");
    expect(text).not.toContain("Totaldos");
    expect(text).not.toContain("Limitesdecr");
  });

  it("returns an empty string when no page has a DATA/ESTABELECIMENTO header", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      { text: "Simulação de parcelamento", lines: [], width: 600 },
    ]);
    const text = await transactionRows(Buffer.from("irrelevant"));
    expect(text).toBe("");
  });
});

describe("extract", () => {
  it("returns no transactions and no text when the table can't be found", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      { text: "Simulação de parcelamento", lines: [], width: 600 },
    ]);
    vi.spyOn(ollamaClient, "chatComplete");
    const [txns, text] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
    expect(text).toBe("");
    expect(ollamaClient.chatComplete).not.toHaveBeenCalled();
  });

  it("calls the LLM with the Itaú hint and a low max_tokens budget on a real PDF", async () => {
    const data = fixture("Fatura_Itau_20260629-180424.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-03-27","description":"DISTRIBUIDOR-CTEI03/03 MORADIA.FRANCODAROC","amount":"156.68"}]'
    );

    const [txns] = await extract(data, []);
    expect(txns).toEqual([
      { date: "2026-03-27", description: "DISTRIBUIDOR-CTEI03/03 MORADIA.FRANCODAROC", amount: "156.68" },
    ]);

    const [systemArg, , maxTokensArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("ESTABELECIMENTO");
    expect(maxTokensArg).toBe(512);
  });

  it("injects LLMFeedback corrections as few-shot examples in the system prompt", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["Fatura Mar/2026", "DATA ESTABELECIMENTO", "27/03 MERCADO 50,00", "Totaldos lançamentos"]),
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");

    await extract(Buffer.from("irrelevant"), [{ date: "2026-03-20", description: "MISSED SHOP", amount: "10.00" }]);

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Previously missed transactions for Itaú");
    expect(systemArg).toContain("MISSED SHOP");
  });

  it("drops a hallucinated transaction whose date+amount don't match any pre-processed line", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["Fatura Mar/2026", "DATA ESTABELECIMENTO", "27/03 MERCADO 50,00", "Totaldos lançamentos"]),
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      JSON.stringify([{ date: "2026-07-19", description: "FABRICATED", amount: "999.99" }])
    );

    const [txns] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
  });
});

describe("transactionRows (mocked pages)", () => {
  it("skips pages without a DATA/ESTABELECIMENTO header and finds a later matching page", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["Simulação de parcelamento", "12x de R$ 45,00"]),
      mockPage(["DATA ESTABELECIMENTO", "27/03 MERCADO 50,00", "Totaldos lançamentos"]),
    ]);

    const text = await transactionRows(Buffer.from("irrelevant"));
    expect(text).toContain("MERCADO");
  });

  it("stops the table at the Fique atento marker (whitespace-stripped match)", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["DATA ESTABELECIMENTO", "27/03 MERCADO 50,00", "Fique atento: prazo de pagamento"]),
    ]);

    const text = await transactionRows(Buffer.from("irrelevant"));
    expect(text).toContain("MERCADO");
    expect(text).not.toContain("Fique atento");
  });

  it("only reads items left of the 60%-width split, ignoring a right-column value", async () => {
    const rightColumnItem = { str: "PARCELA 3/6", transform: [1, 0, 0, 1, 900, 990], width: 60 };
    const page = mockPage(["DATA ESTABELECIMENTO", "27/03 MERCADO 50,00"], 1000);
    page.lines[1].items.push(rightColumnItem);

    vi.spyOn(importersBase, "extractPages").mockResolvedValue([page]);
    const text = await transactionRows(Buffer.from("irrelevant"));
    expect(text).not.toContain("PARCELA 3/6");
  });
});

describe("cleanRows (mocked pages)", () => {
  it("produces a clean 'date description amount' line for a single-line transaction", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["Fatura Mar/2026", "DATA ESTABELECIMENTO", "27/03 MERCADO CENTRAL 89,90", "Totaldos lançamentos"]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text).toBe("2026-03-27 MERCADO CENTRAL 89.90");
  });

  it("appends an ALL-CAPS continuation line to the pending description", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage([
        "Fatura Mar/2026",
        "DATA ESTABELECIMENTO",
        "27/03 DISTRIBUIDOR-CTEI03/03 156,68",
        "MORADIA FRANCODAROC",
        "Totaldos lançamentos",
      ]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text).toBe("2026-03-27 DISTRIBUIDOR-CTEI03/03 MORADIA FRANCODAROC 156.68");
  });

  it("stops taking continuation words once a lowercase-containing word is hit", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage([
        "Fatura Mar/2026",
        "DATA ESTABELECIMENTO",
        "27/03 MERCADO 50,00",
        "MORADIA de Franco",
        "Totaldos lançamentos",
      ]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text).toBe("2026-03-27 MERCADO MORADIA 50.00");
  });

  it("stops taking continuation words at a full-amount-shaped token (right-column artifact)", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage([
        "Fatura Mar/2026",
        "DATA ESTABELECIMENTO",
        "27/03 MERCADO 50,00",
        "1.234,56 EXTRA",
        "Totaldos lançamentos",
      ]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text).toBe("2026-03-27 MERCADO 50.00");
  });

  it("falls back to 'Transação' when a line has an amount but no description text", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage(["Fatura Mar/2026", "DATA ESTABELECIMENTO", "27/03 50,00", "Totaldos lançamentos"]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text).toBe("2026-03-27 Transação 50.00");
  });

  it("returns an empty string when transactionRows finds no table at all", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([mockPage(["Simulação de parcelamento"])]);
    expect(await cleanRows(Buffer.from("irrelevant"))).toBe("");
  });

  it("emits one clean line per transaction across multiple rows", async () => {
    vi.spyOn(importersBase, "extractPages").mockResolvedValue([
      mockPage([
        "Fatura Mar/2026",
        "DATA ESTABELECIMENTO",
        "27/03 MERCADO 50,00",
        "28/03 FARMACIA 20,00",
        "Totaldos lançamentos",
      ]),
    ]);

    const text = await cleanRows(Buffer.from("irrelevant"));
    expect(text.split("\n")).toEqual(["2026-03-27 MERCADO 50.00", "2026-03-28 FARMACIA 20.00"]);
  });
});
