// Shared LLM plumbing and response parsing used by every bank module —
// ported from bank-statement-extractor's banks/base.py.
import { chatComplete } from "./ollama-client";

export interface LlmTransaction {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: string; // positive decimal string, 2 places
}

export interface LlmCorrection {
  date: string;
  description: string;
  amount: string;
}

export const SYSTEM_PROMPT = `\
You are a financial data extractor. Extract all purchase and debit transactions from this Brazilian bank statement.

INCLUDE: purchases, PIX sent, TED sent, withdrawals, fees, loan installments, debit card purchases.
EXCLUDE: incoming payments ("PIX recebido", "TED recebida", "Pagamento recebido"), credits, "Pagamento da fatura",
         balance lines, interest summaries, totals, opening/closing balance entries.

For each transaction output:
- date: YYYY-MM-DD  (infer year from the statement header)
- description: concise merchant or counterpart name; include "Parcela X/Y" if present
- amount: positive decimal string with 2 decimal places, e.g. "123.45"

Respond with ONLY a valid JSON array — no markdown, no explanation before or after.
Example: [{"date":"2026-05-11","description":"SUPERMERCADO ABC","amount":"89.90"}]`;

const CREDIT_RE =
  /pagamento\s+da\s+fatura|pagamento\s+recebido|pix\s+recebido|ted\s+recebida?|transf(?:er[eê]ncia)?\s+recebida?|estorno|devolu[cç][aã]o|reembolso|cr[eé]dito\s+em\s+conta|rendimento|saldo\s+(anterior|final|inicial)|total\s+d[ao]s?\s+(fatura|lançamentos)|cod\.\s*lanc/i;

export interface CallLlmOptions {
  extraHint?: string;
  maxTokens?: number;
  systemOverride?: string;
  corrections?: LlmCorrection[];
}

export async function callLlm(text: string, bank: string, opts: CallLlmOptions): Promise<LlmTransaction[]> {
  const { extraHint = "", maxTokens = 2048, systemOverride = "", corrections = [] } = opts;

  let system = systemOverride || SYSTEM_PROMPT + extraHint;
  if (corrections.length > 0) {
    const examples = corrections
      .slice(0, 8)
      .map((c) => `- ${c.date} ${c.description} ${c.amount}`)
      .join("\n");
    system += `\n\nPreviously missed transactions for ${bank} that must always be included if they appear:\n${examples}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const user = `Bank: ${bank}\nToday: ${today}\n\nStatement:\n${text}`;

  const raw = await chatComplete(system, user, maxTokens);
  if (raw === null) return [];
  return parseResponse(raw);
}

export function parseResponse(raw: string): LlmTransaction[] {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let items: unknown[];
  try {
    items = JSON.parse(match[0]);
  } catch {
    return [];
  }

  const result: LlmTransaction[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const txnDate = normDate(String(record.date ?? ""));
    const desc = String(record.description ?? "").trim();
    const amount = normAmount(record.amount);
    if (txnDate && desc && amount && !CREDIT_RE.test(desc)) {
      result.push({ date: txnDate, description: desc, amount });
    }
  }
  return result;
}

export function normDate(value: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y.length === 2 ? `20${y}` : y}-${mo}-${d}`;
  }
  return "";
}

export function normAmount(value: unknown): string {
  let s = String(value ?? "")
    .trim()
    .replace(/[R$\s]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const f = Number(s);
  if (!Number.isFinite(f) || f <= 0) return "";
  return Math.abs(f).toFixed(2);
}

/** Fallback for unrecognized banks: full-text LLM extraction, no pre-processing. */
export async function extractGeneric(
  fullText: string,
  bank: string,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const txns = await callLlm(fullText, bank, { corrections });
  return [txns, fullText];
}
