import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { healthCheck, extract } from "@/lib/LLM-extract";
import * as ollamaClient from "@/lib/LLM-extract/ollama-client";
import * as dispatch from "@/lib/LLM-extract/dispatch";

beforeEach(() => {
  vi.spyOn(ollamaClient, "healthCheck");
  vi.spyOn(dispatch, "extract");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("healthCheck", () => {
  it("delegates to the ollama client's health check", async () => {
    vi.mocked(ollamaClient.healthCheck).mockResolvedValue(true);
    expect(await healthCheck()).toBe(true);
  });
});

describe("extract", () => {
  it("wraps dispatched transactions with an index, matching the LLM-client.ts shape", async () => {
    vi.mocked(dispatch.extract).mockResolvedValue([
      [{ date: "2026-03-27", description: "X", amount: "10.00" }],
      "some text",
    ]);

    const result = await extract(Buffer.from("pdf-bytes"), "Nubank", [
      { date: "2026-01-01", description: "Y", amount: "5.00" },
    ]);

    expect(dispatch.extract).toHaveBeenCalledWith(Buffer.from("pdf-bytes"), "Nubank", [
      { date: "2026-01-01", description: "Y", amount: "5.00" },
    ]);
    expect("transactions" in result && result.transactions).toEqual([
      { index: 0, date: "2026-03-27", description: "X", amount: "10.00" },
    ]);
    expect("extractedText" in result && result.extractedText).toBe("some text");
  });

  it("defaults bankHint/corrections when omitted", async () => {
    vi.mocked(dispatch.extract).mockResolvedValue([[], ""]);
    await extract(Buffer.from("pdf"));
    expect(dispatch.extract).toHaveBeenCalledWith(Buffer.from("pdf"), "", []);
  });
});
