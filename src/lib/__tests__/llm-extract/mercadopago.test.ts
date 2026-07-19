import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { transactionSection, cleanLines, extract } from "@/lib/llm-extract/mercadopago";
import * as ollamaClient from "@/lib/llm-extract/ollama-client";
import * as importersBase from "@/lib/importers/base";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function fixture(name: string): Buffer | null {
  const p = path.join(FIXTURES_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

function mockPages(pages: string[]) {
  vi.spyOn(importersBase, "extractTextPages").mockResolvedValue(pages);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("transactionSection", () => {
  it("extracts only lines between the Data Movimentações header and Total R$", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "cover page\nData Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23\nfooter",
    ]);

    const text = await transactionSection(Buffer.from("irrelevant"));
    expect(text).toBe("05/04 SUPERMERCADO R$ 111,23");
  });

  it("handles a non-breaking-space variant of the Total R$ footer", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23",
    ]);

    const text = await transactionSection(Buffer.from("irrelevant"));
    expect(text).toBe("05/04 SUPERMERCADO R$ 111,23");
  });

  it("returns an empty string when the header is never found", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue(["nothing relevant here"]);
    expect(await transactionSection(Buffer.from("irrelevant"))).toBe("");
  });
});

describe("extract", () => {
  it("calls the LLM with the Mercado Pago hint and a low max_tokens budget", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-04-05","description":"SUPERMERCADO","amount":"111.23"}]'
    );

    const [txns] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([{ date: "2026-04-05", description: "SUPERMERCADO", amount: "111.23" }]);

    const [systemArg, , maxTokensArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Mercado Pago");
    expect(maxTokensArg).toBe(512);
  });

  it("extracts the transaction section from a real Mercado Pago PDF", async () => {
    const data = fixture("credit-card-mp-statement.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    const [, text] = await extract(data, []);
    expect(text).not.toBe("");
  });

  it("injects LLMFeedback corrections as few-shot examples in the system prompt", async () => {
    mockPages(["Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23"]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");

    await extract(Buffer.from("irrelevant"), [{ date: "2026-03-20", description: "MISSED SHOP", amount: "10.00" }]);

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Previously missed transactions for Mercado Pago");
    expect(systemArg).toContain("MISSED SHOP");
  });

  it("drops a hallucinated transaction whose date+amount don't match any pre-processed line", async () => {
    mockPages(["Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23"]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      JSON.stringify([{ date: "2026-07-19", description: "FABRICATED", amount: "999.99" }])
    );

    const [txns] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
  });
});

describe("cleanLines", () => {
  it("detects the year from a 'Vencimento:' header line", async () => {
    mockPages(["Vencimento: 10/04/2026\nData Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23"]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-04-05 SUPERMERCADO 111.23");
  });

  it("falls back to the current year when no year header matches", async () => {
    mockPages(["Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23"]);

    const expectedYear = new Date().getFullYear();
    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe(`${expectedYear}-04-05 SUPERMERCADO 111.23`);
  });

  it("skips a line matching the SKIP list even though it otherwise fits the transaction shape", async () => {
    mockPages([
      "Data Movimentações\n05/04 Cartão Visa R$ 111,23\n06/04 SUPERMERCADO R$ 50,00\nTotal R$ 50,00",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-04-06 SUPERMERCADO 50.00");
  });

  it("skips a section line that doesn't match the transaction regex shape", async () => {
    mockPages([
      "Data Movimentações\nSaldo anterior R$ 1.000,00\n05/04 SUPERMERCADO R$ 111,23\nTotal R$ 111,23",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-04-05 SUPERMERCADO 111.23");
  });

  it("preserves a 'Parcela X de Y' suffix in the description", async () => {
    mockPages([
      "Data Movimentações\n05/04 MP*CARLOSJORGEMA Parcela 2 de 3 R$ 111,23\nTotal R$ 111,23",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-04-05 MP*CARLOSJORGEMA Parcela 2 de 3 111.23");
  });

  it("skips a zero-amount line", async () => {
    mockPages([
      "Data Movimentações\n05/04 ESTORNO R$ 0,00\n06/04 SUPERMERCADO R$ 50,00\nTotal R$ 50,00",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-04-06 SUPERMERCADO 50.00");
  });

  it("captures transactions whose lines are split across two page strings", async () => {
    mockPages(["Data Movimentações\n05/04 SUPERMERCADO R$ 111,23", "06/04 FARMACIA R$ 20,00\nTotal R$ 20,00"]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text.split("\n")).toEqual(["2026-04-05 SUPERMERCADO 111.23", "2026-04-06 FARMACIA 20.00"]);
  });

  it("does not end the section on a 'Total R$' substring that isn't at the start of the line", async () => {
    mockPages([
      "Data Movimentações\n05/04 SUPERMERCADO R$ 111,23\nSubtotal Total R$ 111,23\n06/04 FARMACIA R$ 20,00\nTotal R$ 20,00",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text.split("\n")).toEqual(["2026-04-05 SUPERMERCADO 111.23", "2026-04-06 FARMACIA 20.00"]);
  });
});
