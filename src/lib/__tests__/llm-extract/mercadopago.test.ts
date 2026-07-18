import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { transactionSection, extract } from "@/lib/llm-extract/mercadopago";
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
});
