// Direct-to-Ollama LLM extraction, replacing the external HTTP sidecar
// (bank-statement-extractor) that used to serve this via LLM_BASE_URL.
// Public interface intentionally matches the old LLM-client.ts's shape so
// callers (src/lib/actions/statement.ts) only needed an import swap.
import { healthCheck as ollamaHealthCheck } from "./ollama-client";
import { extract as dispatchExtract } from "./dispatch";
import type { LLMCorrection, LLMTransaction } from "./base";

export type { LLMCorrection } from "./base";

export interface LLMExtractResult {
  transactions: ({ index: number } & Record<string, unknown>)[];
  extractedText: string;
}

export async function healthCheck(): Promise<boolean> {
  return ollamaHealthCheck();
}

export async function extract(
  pdfBytes: Buffer,
  bankHint = "",
  corrections: LLMCorrection[] = []
): Promise<LLMExtractResult | Record<string, never>> {
  const [transactions, extractedText]: [LLMTransaction[], string] = await dispatchExtract(
    pdfBytes,
    bankHint,
    corrections
  );

  return {
    transactions: transactions.map((t, i) => ({ index: i, ...t })),
    extractedText,
  };
}
