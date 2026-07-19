// Nubank extraction: separate strategies for credit card (fatura) and
// current account (extrato) statements — ported from banks/nubank.py.
import {
  CARD_TX_RE,
  CC_SKIP,
  DATE_HEADER_RE,
  LINE_END_AMOUNT_RE,
  parseShortDate,
} from "@/lib/importers/nubank";
import { MONTHS_PT, detectYear, extractTextPages, parseBrAmount, parseBrDate } from "@/lib/importers/base";
import { extractChunked, type LlmCorrection, type LlmTransaction } from "./base";

// Strict pass-through prompts, mirroring bradesco.ts/itau.ts/mercadopago.ts:
// dates/amounts are already computed deterministically below, so the LLM's
// only job is copying already-unambiguous lines forward.
const CARTAO_SYSTEM_PROMPT_OVERRIDE = `\
Convert each input line to a JSON object. Every line is a confirmed Nubank credit card (fatura) transaction — do NOT skip, filter, or deduplicate any of them.

Each line format: YYYY-MM-DD DESCRIPTION AMOUNT

- date: copy exactly as YYYY-MM-DD
- description: the text between the date and the last number on the line
- amount: the last number on the line, already in decimal format (e.g. 68.59), copy as a string with 2 decimal places

Output ONLY a valid JSON array:
[{"date":"2026-05-04","description":"MERCHANT NAME","amount":"68.59"}]

Include ALL lines without exception.`;

const EXTRATO_SYSTEM_PROMPT_OVERRIDE = `\
Convert each input line to a JSON object. Every line is a confirmed Nubank current account (extrato) transaction — do NOT skip, filter, or deduplicate any of them.

Each line format: YYYY-MM-DD DESCRIPTION AMOUNT

- date: copy exactly as YYYY-MM-DD
- description: the text between the date and the last number on the line
- amount: the last number on the line, already in decimal format (e.g. 92.49), copy as a string with 2 decimal places

Output ONLY a valid JSON array:
[{"date":"2026-05-01","description":"MERCHANT NAME","amount":"92.49"}]

Include ALL lines without exception.`;

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const pages = await extractTextPages(pdfBytes);
  if (pages.join("\n").includes("Movimentações")) {
    return extractExtrato(pages, corrections);
  }
  return extractCartao(pages, corrections);
}

/** Extrato has many transactions spread across pages — day-header state persists across page boundaries. */
async function extractExtrato(
  pagesText: string[],
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const lines = cleanExtratoLines(pagesText);
  if (lines.length === 0) return [[], ""];

  const filtered = await extractChunked(lines, "Nubank", {
    systemOverride: EXTRATO_SYSTEM_PROMPT_OVERRIDE,
    corrections,
  });
  return [filtered, lines.join("\n")];
}

/**
 * Fatura: transactions appear on pages with real 'DD MMM •••• NNNN ... R$ x,xx'
 * rows. Page qualification now requires an actual transaction-line match
 * (CARD_TX_RE), not just the 'TRANSAÇÕES' heading substring — the fatura
 * summary page's unrelated 'VALOR MÁXIMO PARA TRANSAÇÕES' heading used to
 * false-positive here, sending a useless page to the LLM on every import.
 */
async function extractCartao(
  pagesText: string[],
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const year = detectYear(pagesText.slice(0, 3));
  const lines: string[] = [];

  for (const pageText of pagesText) {
    const hasRealTransactionRow = pageText.split("\n").some((line) => CARD_TX_RE.test(line.trim()));
    if (!hasRealTransactionRow) continue;
    lines.push(...cleanCartaoLines(pageText, year));
  }

  if (lines.length === 0) return [[], ""];

  const filtered = await extractChunked(lines, "Nubank", {
    systemOverride: CARTAO_SYSTEM_PROMPT_OVERRIDE,
    maxTokens: 2048,
    corrections,
  });
  return [filtered, lines.join("\n")];
}

/**
 * Pre-process a fatura page into unambiguous 'YYYY-MM-DD DESCRIPTION AMOUNT'
 * lines, deterministically in code — mirrors importers/nubank.ts's
 * parseCartao().
 */
function cleanCartaoLines(pageText: string, year: number): string[] {
  const out: string[] = [];
  for (const rawLine of pageText.split("\n")) {
    const cell = rawLine.trim();
    if (cell.includes("IOF de")) continue;

    const m = cell.match(CARD_TX_RE);
    if (!m) continue;

    const txnDate = parseShortDate(m[1], year);
    if (!txnDate) continue;

    const amount = parseBrAmount(m[3]);
    if (amount === null || amount <= 0) continue;

    out.push(`${txnDate} ${m[2].trim()} ${amount.toFixed(2)}`);
  }
  return out;
}

/**
 * Pre-process all extrato pages into unambiguous 'YYYY-MM-DD DESCRIPTION
 * AMOUNT' lines, deterministically in code — mirrors importers/nubank.ts's
 * parseContaCorrente(). Day-header state must persist across pages (unlike
 * cartão, which is page-independent), so this walks all pages in order.
 */
function cleanExtratoLines(pagesText: string[]): string[] {
  const out: string[] = [];
  let currentDate: string | null = null;

  for (const page of pagesText) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const headerMatch = line.match(DATE_HEADER_RE);
      if (headerMatch && line.includes("Total de")) {
        const month = MONTHS_PT[headerMatch[2]];
        if (month) {
          const date = parseBrDate(Number(headerMatch[1]), month, Number(headerMatch[3]));
          if (date) currentDate = date;
        }
        continue;
      }

      if (CC_SKIP.some((s) => line.startsWith(s))) continue;

      const am = line.match(LINE_END_AMOUNT_RE);
      if (am && currentDate && am.index !== undefined) {
        const amount = parseBrAmount(am[1]);
        if (amount !== null && amount >= 0.01) {
          const desc = line.slice(0, am.index).trim();
          if (desc) out.push(`${currentDate} ${desc} ${amount.toFixed(2)}`);
        }
      }
    }
  }

  return out;
}
