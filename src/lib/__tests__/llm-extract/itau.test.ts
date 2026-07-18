import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { transactionRows, extract } from "@/lib/llm-extract/itau";
import * as ollamaClient from "@/lib/llm-extract/ollama-client";
import * as importersBase from "@/lib/importers/base";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function fixture(name: string): Buffer | null {
  const p = path.join(FIXTURES_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
});
