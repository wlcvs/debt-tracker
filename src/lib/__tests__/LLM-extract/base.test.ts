import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normDate, normAmount, parseResponse, callLLM, extractGeneric } from "@/lib/LLM-extract/base";
import * as ollamaClient from "@/lib/LLM-extract/ollama-client";

describe("normDate", () => {
  it("passes through an already-ISO date", () => {
    expect(normDate("2026-05-11")).toBe("2026-05-11");
  });

  it("converts DD/MM/YYYY to ISO", () => {
    expect(normDate("11/05/2026")).toBe("2026-05-11");
  });

  it("expands a 2-digit year", () => {
    expect(normDate("11/05/26")).toBe("2026-05-11");
  });

  it("returns empty string for garbage input", () => {
    expect(normDate("not a date")).toBe("");
  });
});

describe("normAmount", () => {
  it("normalizes a simple BR amount", () => {
    expect(normAmount("156,68")).toBe("156.68");
  });

  it("normalizes a thousands-separated BR amount", () => {
    expect(normAmount("1.234,56")).toBe("1234.56");
  });

  it("strips R$ and whitespace", () => {
    expect(normAmount("R$ 89,90")).toBe("89.90");
  });

  it("returns absolute value formatted to 2 decimals for a plain dot-decimal number", () => {
    expect(normAmount("89.9")).toBe("89.90");
  });

  it("returns empty string for zero or negative amounts", () => {
    expect(normAmount("0")).toBe("");
    expect(normAmount("-10,00")).toBe("");
  });

  it("returns empty string for garbage input", () => {
    expect(normAmount("garbage")).toBe("");
  });
});

describe("parseResponse", () => {
  it("parses a clean JSON array", () => {
    const raw = '[{"date":"2026-05-11","description":"SUPERMERCADO ABC","amount":"89.90"}]';
    expect(parseResponse(raw)).toEqual([{ date: "2026-05-11", description: "SUPERMERCADO ABC", amount: "89.90" }]);
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n[{"date":"2026-05-11","description":"X","amount":"10.00"}]\n```';
    expect(parseResponse(raw)).toEqual([{ date: "2026-05-11", description: "X", amount: "10.00" }]);
  });

  it("filters out credit-like descriptions via the safety-net regex", () => {
    const raw = JSON.stringify([
      { date: "2026-05-11", description: "PIX recebido de Fulano", amount: "50.00" },
      { date: "2026-05-12", description: "Pagamento da fatura", amount: "500.00" },
      { date: "2026-05-13", description: "SUPERMERCADO ABC", amount: "89.90" },
    ]);
    expect(parseResponse(raw)).toEqual([{ date: "2026-05-13", description: "SUPERMERCADO ABC", amount: "89.90" }]);
  });

  it("drops entries missing a valid date, description, or amount", () => {
    const raw = JSON.stringify([
      { date: "", description: "X", amount: "10.00" },
      { date: "2026-05-11", description: "", amount: "10.00" },
      { date: "2026-05-11", description: "X", amount: "0" },
      { date: "2026-05-11", description: "Y", amount: "10.00" },
    ]);
    expect(parseResponse(raw)).toEqual([{ date: "2026-05-11", description: "Y", amount: "10.00" }]);
  });

  it("returns an empty array when no JSON array is present", () => {
    expect(parseResponse("no json here")).toEqual([]);
  });

  it("returns an empty array for malformed JSON", () => {
    expect(parseResponse("[{broken")).toEqual([]);
  });
});

describe("callLLM", () => {
  beforeEach(() => {
    vi.spyOn(ollamaClient, "chatComplete");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the system+user prompt and returns parsed transactions", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue(
      '[{"date":"2026-05-11","description":"SUPERMERCADO ABC","amount":"89.90"}]'
    );

    const result = await callLLM("statement text", "Nubank", {});

    expect(result).toEqual([{ date: "2026-05-11", description: "SUPERMERCADO ABC", amount: "89.90" }]);
    const [systemArg, userArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("financial data extractor");
    expect(userArg).toContain("Bank: Nubank");
    expect(userArg).toContain("statement text");
  });

  it("appends an extra hint to the system prompt", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue("[]");
    await callLLM("text", "Itaú", { extraHint: "\n\nItaú hint" });
    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Itaú hint");
  });

  it("uses a system prompt override instead of the default when given", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue("[]");
    await callLLM("text", "Bradesco", { systemOverride: "Custom override prompt" });
    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Custom override prompt");
    expect(systemArg).not.toContain("financial data extractor");
  });

  it("injects corrections as few-shot examples, capped at 8", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue("[]");
    const corrections = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-0${(i % 9) + 1}`,
      description: `MISSED ${i}`,
      amount: "10.00",
    }));

    await callLLM("text", "Nubank", { corrections });
    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("Previously missed transactions for Nubank");
    expect(systemArg).toContain("MISSED 0");
    expect(systemArg).not.toContain("MISSED 9");
  });

  it("returns an empty array when the LLM is unreachable", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue(null);
    expect(await callLLM("text", "Nubank", {})).toEqual([]);
  });
});

describe("extractGeneric", () => {
  beforeEach(() => {
    vi.spyOn(ollamaClient, "chatComplete");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the full extracted text with no pre-processing", async () => {
    vi.mocked(ollamaClient.chatComplete).mockResolvedValue(
      '[{"date":"2026-05-11","description":"X","amount":"10.00"}]'
    );

    const [txns, text] = await extractGeneric("raw full text", "Desconhecido", []);

    expect(text).toBe("raw full text");
    expect(txns).toEqual([{ date: "2026-05-11", description: "X", amount: "10.00" }]);
    const [, userArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(userArg).toContain("raw full text");
  });
});
