import { lineText } from "@/lib/pdf/group-lines";
import { type Transaction, MONTHS_PT, detectYear, parseBrAmount, parseBrDate, extractPages, type PdfPage } from "./base";

// Current account (extrato)
export const DATE_HEADER_RE = /^(\d{2}) ([A-Z]{3}) (\d{4})/;
export const LINE_END_AMOUNT_RE = /\s(\d{1,3}(?:\.\d{3})*,\d{2})$/;

export const CC_SKIP = [
  "Saldo inicial", "Saldo final", "Rendimento", "Total de", "Movimentações",
  "Tem alguma dúvida", "Caso a solução", "Extrato gerado", "Nu Financeira",
  "Nu Pagamentos", "CNPJ:", "CPF", "O saldo", "Não nos responsabilizamos",
  "Asseguramos", "Wallacy Vieira da Silva", "Agência 0001",
];

// Card: "04 MAI •••• 8119 Description [- Parcela X/Y] R$ 68,59"
export const CARD_TX_RE = /^(\d{2} [A-Z]{3})\s+[•]+\s+\d+\s+(.+?)\s+R\$\s+([\d.,]+)/;

export async function parse(data: Buffer | Uint8Array): Promise<Transaction[]> {
  const pages = await extractPages(data);
  const fullText = pages.map((p) => p.text).join("\n");
  if (fullText.includes("Movimentações")) {
    return parseContaCorrente(pages.map((p) => p.text));
  }
  return parseCartao(pages);
}

// ── Current account ────────────────────────────────────────────────────────────

function parseContaCorrente(pagesText: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  let currentDate: string | null = null;

  for (const page of pagesText) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      // "01 MAI 2026 Total de saídas - 92,49" — day section header
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

      // Transaction line ends with a BR amount
      const am = line.match(LINE_END_AMOUNT_RE);
      if (am && currentDate && am.index !== undefined) {
        const amount = parseBrAmount(am[1]);
        if (amount !== null && amount >= 0.01) {
          const desc = cleanCcDesc(line.slice(0, am.index).trim());
          if (desc) transactions.push({ date: currentDate, description: desc, amount });
        }
      }
    }
  }

  return transactions;
}

function cleanCcDesc(text: string): string {
  text = text.replace(/\s*-\s*•+\.\d+\.\d+-••/, "");
  text = text.replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, "");
  text = text.replace(/\s+-\s+[A-Z]{2}[\w\s.]+\(\d+\).*$/, "");
  text = text.replace(/\s+-\s+[A-Z]+$/, "");
  return text.replace(/^[ \-•]+|[ \-•]+$/g, "");
}

// ── Credit card ────────────────────────────────────────────────────────────────

function parseCartao(pages: PdfPage[]): Transaction[] {
  const year = detectYear(pages.slice(0, 3).map((p) => p.text));

  const transactions: Transaction[] = [];

  for (const page of pages) {
    for (const line of page.lines) {
      const cell = lineText(line).trim();
      if (cell.includes("IOF de")) continue;

      const m = cell.match(CARD_TX_RE);
      if (!m) continue;

      const txnDate = parseShortDate(m[1], year);
      if (!txnDate) continue;

      const amount = parseBrAmount(m[3]);
      if (amount !== null && amount > 0) {
        transactions.push({ date: txnDate, description: m[2].trim(), amount });
      }
    }
  }

  return transactions;
}

export function parseShortDate(dateStr: string, year: number): string | null {
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = MONTHS_PT[parts[1].toUpperCase().slice(0, 3)];
  if (!month) return null;
  return parseBrDate(Number(parts[0]), month, year);
}
