import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { extract } from "@/lib/LLM-extract/nubank";
import * as ollamaClient from "@/lib/LLM-extract/ollama-client";
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
  it("pre-processes real transaction lines into clean YYYY-MM-DD rows and calls the LLM with the extrato prompt", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nMERCHANT ONE 92,49",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-05-01","description":"MERCHANT ONE","amount":"92.49"}]'
    );

    const [txns, text] = await extract(Buffer.from("irrelevant"), []);

    expect(ollamaClient.chatComplete).toHaveBeenCalledTimes(1);
    expect(txns).toEqual([{ date: "2026-05-01", description: "MERCHANT ONE", amount: "92.49" }]);
    expect(text).toBe("2026-05-01 MERCHANT ONE 92.49");

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("current account");
  });

  it("drops an LLM response that doesn't match a real pre-processed line (hallucination guard)", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "Movimentações\n01 MAI 2026 Total de saídas - 92,49\nMERCHANT ONE 92,49",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-07-19","description":"FABRICATED","amount":"999.99"}]'
    );

    const [txns] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
  });

  it("returns no transactions and no LLM call when no real transaction lines are found", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue(["Movimentações\nSaldo inicial R$ 100,00"]);
    vi.spyOn(ollamaClient, "chatComplete");

    const [txns, text] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
    expect(text).toBe("");
    expect(ollamaClient.chatComplete).not.toHaveBeenCalled();
  });
});

describe("extract — cartão (fatura)", () => {
  it("only processes pages with a real transaction row, with the cartão prompt", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "cover page",
      "VALOR MÁXIMO PARA TRANSAÇÕES\nSaque no crédito R$ 945,00", // false-positive heading, no real row — must be skipped
      "TRANSAÇÕES DE 04 JUN A 04 JUL\n04 MAI •••• 8119 MERCHANT NAME R$ 68,59",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-05-04","description":"MERCHANT NAME","amount":"68.59"}]'
    );

    const [txns, text] = await extract(Buffer.from("irrelevant"), []);

    expect(ollamaClient.chatComplete).toHaveBeenCalledTimes(1);
    expect(txns).toEqual([{ date: "2026-05-04", description: "MERCHANT NAME", amount: "68.59" }]);
    expect(text).toBe("2026-05-04 MERCHANT NAME 68.59");

    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("credit card");
  });

  it("skips IOF lines during pre-processing", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([
      "TRANSAÇÕES DE 04 JUN A 04 JUL\n" +
        "04 MAI •••• 8119 MERCHANT NAME R$ 68,59\n" +
        "23 JUN IOF de \"MERCHANT NAME\" R$ 4,00",
    ]);
    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue(
      '[{"date":"2026-05-04","description":"MERCHANT NAME","amount":"68.59"}]'
    );

    const [, text] = await extract(Buffer.from("irrelevant"), []);
    expect(text).toBe("2026-05-04 MERCHANT NAME 68.59");
  });
});

describe("extract (real PDFs)", () => {
  it("extracts from a Nubank current-account statement", async () => {
    const data = fixture("NU_237744153_01MAI2026_31MAI2026.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    const [, text] = await extract(data, []);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it("extracts from a Nubank credit card fatura statement", async () => {
    const data = fixture("Nubank_2026-07-11.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    const [, text] = await extract(data, []);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });
});
