// Direct client for Ollama's OpenAI-compatible API. Configure OLLAMA_BASE_URL
// in .env (e.g. http://localhost:11434/v1 locally, or a tunnel URL such as a
// Cloudflare Tunnel/Tailscale Funnel hostname when this app runs on Vercel).
// If unset or the server is unreachable/slow, all calls resolve to null
// silently so the import flow always falls back to algorithmic-only results.

// Keep a couple seconds under the import route's `maxDuration` (see
// src/lib/actions/statement.ts) so a timeout here always wins the race against
// the platform killing the whole function.
const CHAT_TIMEOUT_MS = 290_000;
const HEALTH_TIMEOUT_MS = 3_000;
const DEFAULT_MODEL = "qwen2.5:3b";

function baseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "").replace(/\/+$/, "");
}

function model(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

export async function healthCheck(): Promise<boolean> {
  const url = baseUrl();
  if (!url) return false;

  try {
    const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function chatComplete(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const url = baseUrl();
  if (!url) return null;

  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
