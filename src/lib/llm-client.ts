// HTTP client for the external LLM extraction server (not part of this repo).
// Configure LLM_BASE_URL in .env (e.g. http://localhost:8001 or an Ngrok URL).
// If unset or the server is unreachable/slow, all calls resolve to {} silently
// so the import flow always falls back to algorithmic-only results.

// Keep a couple seconds under the import route's `maxDuration` (see
// src/lib/actions/statement.ts) so a timeout here always wins the race against
// the platform killing the whole function.
const EXTRACT_TIMEOUT_MS = 290_000;
const HEALTH_TIMEOUT_MS = 3_000;

function baseUrl(): string {
  return (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
}

export async function healthCheck(): Promise<boolean> {
  const url = baseUrl();
  if (!url) return false;

  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return res.status === 200;
  } catch {
    return false;
  }
}

export interface LlmCorrection {
  date: string;
  description: string;
  amount: string;
}

export interface LlmExtractResult {
  transactions: ({ index: number } & Record<string, unknown>)[];
  extractedText: string;
}

export async function extract(
  pdfBytes: Buffer,
  bankHint = "",
  corrections: LlmCorrection[] = []
): Promise<LlmExtractResult | Record<string, never>> {
  const url = baseUrl();
  if (!url) return {};

  const form = new FormData();
  form.set("bank", bankHint);
  form.set("corrections", JSON.stringify(corrections));
  form.set("pdf", new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }), "statement.pdf");

  try {
    const res = await fetch(`${url}/extract`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
    if (!res.ok) return {};

    const data = await res.json();
    const txns = Array.isArray(data.transactions) ? data.transactions : [];
    return {
      transactions: txns.map((t: Record<string, unknown>, i: number) => ({ index: i, ...t })),
      extractedText: typeof data.extracted_text === "string" ? data.extracted_text : "",
    };
  } catch {
    return {};
  }
}
