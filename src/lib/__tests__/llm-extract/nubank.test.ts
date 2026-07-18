import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { extract } from "@/lib/llm-extract/nubank";
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

describe("extract — extrato (current account)", () => {
  it("calls the LLM once per non-empty page with the extrato hint and dedups across pages", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "Movimentações\npage one",
      "",
      "page two",
    ]);
    vi.spyOn(ollamaClient, "chatComplete")
      .mockResolvedValueOnce('[{"date":"2026-05-01","description":"A","amount":"10.00"}]')
      .mockResolvedValueOnce('[{"date":"2026-05-01","description":"A","amount":"10.00"}]');

    const [txns, text] = await extract(Buffer.from("irrelevant"), []);

    expect(ollamaClient.chatComplete).toHaveBeenCalledTimes(2);
    expect(txns).toEqual([{ date: "2026-05-01", description: "A", amount: "10.00" }]);
    expect(text).toBe("Movimentações\npage one\n\n---\n\npage two");

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("current account");
  });
});

describe("extract — cartão (fatura)", () => {
  it("only processes pages containing TRANSAÇÕES, with the cartão hint", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "cover page",
      "TRANSAÇÕES\nfatura page",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-05-04","description":"MERCHANT","amount":"68.59"}]'
    );

    const [txns, text] = await extract(Buffer.from("irrelevant"), []);

    expect(ollamaClient.chatComplete).toHaveBeenCalledTimes(1);
    expect(txns).toEqual([{ date: "2026-05-04", description: "MERCHANT", amount: "68.59" }]);
    expect(text).toBe("TRANSAÇÕES\nfatura page");

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("credit card");
  });
});

describe("extract (real PDFs)", () => {
  it("extracts from a Nubank current-account statement", async () => {
    const data = fixture("NU_237744153_01MAI2026_31MAI2026.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    const [, text] = await extract(data, []);
    expect(text).toContain("Movimentações");
  });

  it("extracts from a Nubank credit card fatura statement", async () => {
    const data = fixture("Nubank_2026-07-11.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    const [, text] = await extract(data, []);
    expect(text).toContain("TRANSAÇÕES");
  });
});
