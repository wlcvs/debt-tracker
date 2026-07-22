// Shared LLM plumbing and response parsing used by every bank module —
// ported from bank-statement-extractor's banks/base.py.
import { chatComplete } from "./ollama-client";

export interface LLMTransaction {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: string; // positive decimal string, 2 places
}

export interface LLMCorrection {
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

export interface CallLLMOptions {
  extraHint?: string;
  maxTokens?: number;
  systemOverride?: string;
  corrections?: LLMCorrection[];
}

export async function callLLM(text: string, bank: string, opts: CallLLMOptions): Promise<LLMTransaction[]> {
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

export function parseResponse(raw: string): LLMTransaction[] {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let items: unknown[];
  try {
    items = JSON.parse(match[0]);
  } catch {
    return [];
  }

  const result: LLMTransaction[] = [];
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

export const CLEAN_LINE_RE = /^(\d{4}-\d{2}-\d{2}) .+ (\d+\.\d{2})$/;

/**
 * Drop any LLM-returned transaction whose date+amount doesn't correspond to a
 * real pre-processed line — eliminates hallucination by construction,
 * regardless of model quality (generalizes the guard bradesco.ts pioneered).
 *
 * One consequence: an LLMCorrection whose line isn't present in the current
 * deterministic pre-processing output is unactionable — the LLM can't invent
 * a line outside its input, and this filter would drop it even if it tried.
 * If corrections stop appearing to "take," suspect the pre-processor's regex
 * missed that line's format, not this filter.
 */
export function filterHallucinations(txns: LLMTransaction[], cleanLines: string[]): LLMTransaction[] {
  const validKeys = new Set(
    cleanLines.map((line) => {
      const m = line.match(CLEAN_LINE_RE);
      return m ? `${m[1]}|${m[2]}` : "";
    })
  );
  return txns.filter((t) => validKeys.has(`${t.date}|${t.amount}`));
}

/**
 * Split a clean-line list into small batches so each LLM call holds fewer
 * lines in context at once — small models start swapping dates/amounts
 * between unrelated lines once a single call holds ~20+ lines. Override via
 * LLM_CHUNK_SIZE for sweeping without code changes.
 *
 * Distributes evenly rather than slicing at a fixed size: a fixed size leaves
 * a small dangling remainder chunk (e.g. 25 lines / 6 -> 6,6,6,6,1) — a
 * lone-line chunk was observed to make a small model hallucinate an extra,
 * fabricated entry instead of just echoing the one real line back, unlike
 * evenly-sized chunks of comparable difficulty elsewhere in the same input.
 */
export function chunkLines(lines: string[], chunkSize = Number(process.env.LLM_CHUNK_SIZE) || 6): string[][] {
  if (lines.length === 0) return [];
  const numChunks = Math.ceil(lines.length / chunkSize);
  const evenSize = Math.ceil(lines.length / numChunks);
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += evenSize) chunks.push(lines.slice(i, i + evenSize));
  return chunks;
}

/** Merge per-chunk LLM results, deduping by date|description|amount. */
export function mergeDedup(batches: LLMTransaction[][]): LLMTransaction[] {
  const seen = new Set<string>();
  const out: LLMTransaction[] = [];
  for (const batch of batches) {
    for (const t of batch) {
      const key = `${t.date}|${t.description}|${t.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    }
  }
  return out;
}

/**
 * Call the LLM once per chunk of `lines`, retrying an individual chunk when
 * its response doesn't account for all of that chunk's own lines.
 *
 * Retries reverse the chunk's line order rather than re-sending it as-is:
 * debugging traced a *deterministic* (not sampling-noise) failure mode where
 * a small model garbles a whole chunk's JSON shape (dropping the amount
 * field for every line) specifically when the chunk ends on a line whose
 * date repeats an earlier line in the same chunk — re-sending the identical
 * order reproduces the identical failure every time, but reversing the order
 * (so a different, usually date-unique line ends the chunk) reliably
 * recovered the correct output in testing. Each attempt's results are
 * validated against the FULL clean-line set (not just this chunk) via
 * filterHallucinations, then restricted back down to only this chunk's own
 * lines before being counted toward coverage or kept — so a retry can never
 * smuggle in another chunk's transaction.
 */
export async function extractChunked(
  lines: string[],
  bank: string,
  LLMOptions: CallLLMOptions,
  maxRetries = 2
): Promise<LLMTransaction[]> {
  const keyOf = (line: string) => {
    const m = line.match(CLEAN_LINE_RE);
    return m ? `${m[1]}|${m[2]}` : "";
  };

  const allBatches: LLMTransaction[][] = [];

  for (const chunk of chunkLines(lines)) {
    const chunkKeys = new Set(chunk.map(keyOf).filter(Boolean));

    let best: LLMTransaction[] = [];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const attemptLines = attempt % 2 === 1 ? [...chunk].reverse() : chunk;
      const raw = await callLLM(attemptLines.join("\n"), bank, LLMOptions);
      const valid = filterHallucinations(raw, lines);
      best = mergeDedup([best, valid]);

      const covered = new Set(best.map((t) => `${t.date}|${t.amount}`));
      if ([...chunkKeys].every((k) => covered.has(k))) break;
    }

    allBatches.push(best.filter((t) => chunkKeys.has(`${t.date}|${t.amount}`)));
  }

  return mergeDedup(allBatches);
}

/** Fallback for unrecognized banks: full-text LLM extraction, no pre-processing. */
export async function extractGeneric(
  fullText: string,
  bank: string,
  corrections: LLMCorrection[]
): Promise<[LLMTransaction[], string]> {
  const txns = await callLLM(fullText, bank, { corrections });
  return [txns, fullText];
}
