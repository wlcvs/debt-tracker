import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { healthCheck, chatComplete } from "@/lib/llm-extract/ollama-client";

const originalUrl = process.env.OLLAMA_BASE_URL;
const originalModel = process.env.OLLAMA_MODEL;
const originalApiKey = process.env.OLLAMA_API_KEY;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.OLLAMA_BASE_URL = originalUrl;
  process.env.OLLAMA_MODEL = originalModel;
  process.env.OLLAMA_API_KEY = originalApiKey;
});

describe("healthCheck", () => {
  it("returns false when OLLAMA_BASE_URL is unset", async () => {
    process.env.OLLAMA_BASE_URL = "";
    expect(await healthCheck()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns true when the server responds 200", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);
    expect(await healthCheck()).toBe(true);
    expect(fetch).toHaveBeenCalledWith("http://localhost:11434/v1/models", expect.anything());
  });

  it("returns false when the request throws (server unreachable)", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await healthCheck()).toBe(false);
  });

  it("sends an Authorization header when OLLAMA_API_KEY is set", async () => {
    process.env.OLLAMA_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.OLLAMA_API_KEY = "gsk_test123";
    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);

    await healthCheck();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options).toMatchObject({ headers: { Authorization: "Bearer gsk_test123" } });
  });

  it("sends no Authorization header when OLLAMA_API_KEY is unset", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    process.env.OLLAMA_API_KEY = "";
    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);

    await healthCheck();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options as { headers?: Record<string, string> }).headers).not.toHaveProperty(
      "Authorization"
    );
  });
});

describe("chatComplete", () => {
  it("returns null when OLLAMA_BASE_URL is unset", async () => {
    process.env.OLLAMA_BASE_URL = "";
    const result = await chatComplete("system", "user", 512);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts chat completion messages and returns the response content", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    process.env.OLLAMA_MODEL = "qwen2.5:3b";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello" } }] }),
    } as Response);

    const result = await chatComplete("sys prompt", "user prompt", 512);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body).toMatchObject({
      model: "qwen2.5:3b",
      temperature: 0.1,
      max_tokens: 512,
      messages: [
        { role: "system", content: "sys prompt" },
        { role: "user", content: "user prompt" },
      ],
    });
    expect(result).toBe("hello");
  });

  it("defaults to LFM2.5-1.2B-Instruct when OLLAMA_MODEL is unset", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    process.env.OLLAMA_MODEL = "";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "x" } }] }),
    } as Response);

    await chatComplete("s", "u", 100);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.model).toBe("hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q8_0");
  });

  it("returns null when the response is not ok", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    expect(await chatComplete("s", "u", 100)).toBeNull();
  });

  it("returns null when the request throws or times out", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    expect(await chatComplete("s", "u", 100)).toBeNull();
  });

  it("sends an Authorization header when OLLAMA_API_KEY is set", async () => {
    process.env.OLLAMA_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.OLLAMA_MODEL = "llama-3.3-70b-versatile";
    process.env.OLLAMA_API_KEY = "gsk_test123";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hi" } }] }),
    } as Response);

    await chatComplete("s", "u", 100);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options).toMatchObject({
      headers: { "Content-Type": "application/json", Authorization: "Bearer gsk_test123" },
    });
  });

  it("sends no Authorization header when OLLAMA_API_KEY is unset", async () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/v1";
    process.env.OLLAMA_API_KEY = "";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hi" } }] }),
    } as Response);

    await chatComplete("s", "u", 100);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options as { headers?: Record<string, string> }).headers).not.toHaveProperty(
      "Authorization"
    );
  });
});
