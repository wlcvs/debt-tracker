// Mercado Pago extraction: only the 'Detalhes de consumo' transaction section
// is sent to the LLM — ported from banks/mercadopago.py.
import { detectYear, extractTextPages, parseBrAmount, parseBrDate } from "@/lib/importers/base";
import { SKIP, TX_RE, YEAR_RE } from "@/lib/importers/mercadopago";
import { extractChunked, type LLMCorrection, type LLMTransaction } from "./base";

// Strict pass-through prompt, mirroring bradesco.ts/itau.ts: dates/amounts are
// already computed deterministically in cleanLines(), so the LLM's only job
// is copying already-unambiguous lines forward — no year math, no filtering.
const SYSTEM_PROMPT_OVERRIDE = `\
Convert each input line to a JSON object. Every line is a confirmed Mercado Pago transaction — do NOT skip, filter, or deduplicate any of them.

Each line format: YYYY-MM-DD DESCRIPTION AMOUNT

- date: copy exactly as YYYY-MM-DD
- description: the text between the date and the last number on the line (include "Parcela X de Y" if present)
- amount: the last number on the line, already in decimal format (e.g. 111.23), copy as a string with 2 decimal places

Output ONLY a valid JSON array:
[{"date":"2026-04-22","description":"MP*CARLOSJORGEMA Parcela 2 de 3","amount":"111.23"}]

Include ALL lines without exception.`;

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LLMCorrection[]
): Promise<[LLMTransaction[], string]> {
  const text = await cleanLines(pdfBytes);
  if (!text) return [[], ""];

  const lines = text.split("\n");
  const filtered = await extractChunked(lines, "Mercado Pago", {
    systemOverride: SYSTEM_PROMPT_OVERRIDE,
    maxTokens: 512,
    corrections,
  });
  return [filtered, text];
}

/** Extract only lines from 'Data Movimentações' header to 'Total R$'. */
export async function transactionSection(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const pages = await extractTextPages(pdfBytes);
  const lines = pages.join("\n").split("\n");

  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (!inSection) {
      if (stripped.includes("Data") && stripped.includes("Movimenta")) inSection = true;
      continue;
    }
    if (stripped.startsWith("Total R$") || stripped.startsWith("Total R$")) break;
    if (stripped) result.push(stripped);
  }

  return result.join("\n");
}

/**
 * Pre-process the transaction section into unambiguous
 * 'YYYY-MM-DD DESCRIPTION AMOUNT' lines, deterministically in code — no LLM
 * involved, mirroring importers/mercadopago.ts's parseText().
 */
export async function cleanLines(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const section = await transactionSection(pdfBytes);
  if (!section) return "";

  const pages = await extractTextPages(pdfBytes);
  const year = detectYear(pages, YEAR_RE);

  const out: string[] = [];
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP.some((s) => line.includes(s))) continue;

    const m = line.match(TX_RE);
    if (!m) continue;

    const [, dateStr, descRaw, amountRaw] = m;
    const [dd, mm] = dateStr.split("/");
    const amount = parseBrAmount(amountRaw);
    if (amount === null || amount <= 0) continue;

    const date = parseBrDate(Number(dd), Number(mm), year);
    if (!date) continue;

    out.push(`${date} ${descRaw.trim()} ${amount.toFixed(2)}`);
  }

  return out.join("\n");
}
