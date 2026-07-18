// Direct-to-Ollama LLM extraction, replacing the external HTTP sidecar
// (bank-statement-extractor) that used to serve this via LLM_BASE_URL.
// Public interface intentionally matches the old llm-client.ts's shape so
// callers (src/lib/actions/statement.ts) only needed an import swap.
import { healthCheck as ollamaHealthCheck } from "./ollama-client";
import { extract as dispatchExtract } from "./dispatch";
import type { LlmCorrection, LlmTransaction } from "./base";

export type { LlmCorrection } from "./base";

export interface LlmExtractResult {
  transactions: ({ index: number } & Record<string, unknown>)[];
  extractedText: string;
}

export async function healthCheck(): Promise<boolean> {
  return ollamaHealthCheck();
}

export async function extract(
  pdfBytes: Buffer,
  bankHint = "",
  corrections: LlmCorrection[] = []
): Promise<LlmExtractResult | Record<string, never>> {
  const [transactions, extractedText]: [LlmTransaction[], string] = await dispatchExtract(
    pdfBytes,
    bankHint,
    corrections
  );

  return {
    transactions: transactions.map((t, i) => ({ index: i, ...t })),
    extractedText,
  };
}
