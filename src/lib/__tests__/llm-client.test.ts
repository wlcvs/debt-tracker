import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { healthCheck, extract } from "@/lib/llm-client";

const originalEnv = process.env.LLM_BASE_URL;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.LLM_BASE_URL = originalEnv;
});

describe("healthCheck", () => {
  it("returns false when LLM_BASE_URL is unset", async () => {
    process.env.LLM_BASE_URL = "";
    expect(await healthCheck()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns true when the server responds 200", async () => {
    process.env.LLM_BASE_URL = "http://localhost:8001";
    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);
    expect(await healthCheck()).toBe(true);
    expect(fetch).toHaveBeenCalledWith("http://localhost:8001/health", expect.anything());
  });

  it("returns false when the request throws (server unreachable)", async () => {
    process.env.LLM_BASE_URL = "http://localhost:8001";
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await healthCheck()).toBe(false);
  });
});

describe("extract", () => {
  it("returns {} when LLM_BASE_URL is unset", async () => {
    process.env.LLM_BASE_URL = "";
    const result = await extract(Buffer.from("pdf"), "Nubank", []);
    expect(result).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts a multipart form with bank/corrections/pdf and returns indexed transactions", async () => {
    process.env.LLM_BASE_URL = "http://localhost:8001";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: [{ date: "2026-03-27", description: "X", amount: "10.00" }],
        extracted_text: "some text",
      }),
    } as Response);

    const result = await extract(Buffer.from("pdf-bytes"), "Nubank", [
      { date: "2026-01-01", description: "Y", amount: "5.00" },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8001/extract",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const form = options!.body as FormData;
    expect(form.get("bank")).toBe("Nubank");
    expect(JSON.parse(form.get("corrections") as string)).toEqual([
      { date: "2026-01-01", description: "Y", amount: "5.00" },
    ]);

    expect("transactions" in result && result.transactions).toEqual([
      { index: 0, date: "2026-03-27", description: "X", amount: "10.00" },
    ]);
    expect("extractedText" in result && result.extractedText).toBe("some text");
  });

  it("returns {} when the response is not ok", async () => {
    process.env.LLM_BASE_URL = "http://localhost:8001";
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const result = await extract(Buffer.from("pdf"), "Nubank", []);
    expect(result).toEqual({});
  });

  it("returns {} when the request throws or times out", async () => {
    process.env.LLM_BASE_URL = "http://localhost:8001";
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    const result = await extract(Buffer.from("pdf"), "Nubank", []);
    expect(result).toEqual({});
  });
});
