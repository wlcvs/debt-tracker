// Nubank extraction: separate strategies for credit card (fatura) and
// current account (extrato) statements — ported from banks/nubank.py.
import { extractTextPages } from "@/lib/importers/base";
import { callLlm, type LlmCorrection, type LlmTransaction } from "./base";

const CARTAO_HINT =
  "\n\nNubank credit card (fatura) format:\n" +
  "Each transaction line: 'DD MMM •••• NNNN  MERCHANT NAME  R$ 68,59'\n" +
  "Portuguese month → number: JAN=01 FEV=02 MAR=03 ABR=04 MAI=05 JUN=06 JUL=07 AGO=08 SET=09 OUT=10 NOV=11 DEZ=12\n" +
  "Year is 2026 (from the statement header).\n" +
  "Skip: lines starting with 'IOF de', lines with negative amounts (−R$), lines starting with 'Pagamento', totals.";

const EXTRATO_HINT =
  "\n\nNubank current account (extrato) format:\n" +
  "Day headers look like: '01 MAI 2026 Total de saídas - 92,49' — these are NOT transactions.\n" +
  "Transaction lines come after a day header and end with a BR amount (e.g. '1.234,56').\n" +
  "Skip: 'Saldo inicial', 'Saldo final', 'Rendimento', 'Nu Pagamentos', header/footer lines.\n" +
  "Each transaction line: description ending with the amount.";

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

/** Extrato has many transactions spread across pages — process page by page to keep each LLM call small and fast. */
async function extractExtrato(
  pagesText: string[],
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const allTransactions: LlmTransaction[] = [];
  const seen = new Set<string>();
  const textParts: string[] = [];

  for (const pageText of pagesText) {
    if (!pageText.trim()) continue;
    textParts.push(pageText);
    const pageTxns = await callLlm(pageText, "Nubank", { extraHint: EXTRATO_HINT, corrections });
    for (const t of pageTxns) {
      const key = `${t.date}|${t.description}|${t.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        allTransactions.push(t);
      }
    }
  }

  return [allTransactions, textParts.join("\n\n---\n\n")];
}

/** Fatura: transactions appear on pages labelled 'TRANSAÇÕES' — process those individually. */
async function extractCartao(
  pagesText: string[],
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const allTransactions: LlmTransaction[] = [];
  const seen = new Set<string>();
  const textParts: string[] = [];

  for (const pageText of pagesText) {
    if (!pageText.includes("TRANSAÇÕES")) continue;
    textParts.push(pageText);
    const pageTxns = await callLlm(pageText, "Nubank", { extraHint: CARTAO_HINT, maxTokens: 2048, corrections });
    for (const t of pageTxns) {
      const key = `${t.date}|${t.description}|${t.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        allTransactions.push(t);
      }
    }
  }

  return [allTransactions, textParts.join("\n\n---\n\n")];
}
