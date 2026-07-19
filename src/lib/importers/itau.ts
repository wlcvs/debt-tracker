import { lineText } from "@/lib/pdf/group-lines";
import {
  type Transaction,
  AMOUNT_RE,
  DATE_SLASH_RE,
  findAllAmounts,
  findYear,
  parseBrAmount,
  parseBrDate,
  extractPages,
  type PdfPage,
} from "./base";

const DEBIT_CREDIT_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])\b/;
export const TX_START_RE = /^(\d{2}\/\d{2})\s+(.+)/;
export const AMOUNT_FULL_RE = new RegExp(`^${AMOUNT_RE.source}$`);
export const STOP_SECTION_RE = /Totalandos|Lançamentosno|LTotaldos|Totaldoslançamentos/;

export async function parse(data: Buffer | Uint8Array): Promise<Transaction[]> {
  const pages = await extractPages(data);
  const pagesText = pages.map((p) => p.text);
  const full = pagesText.join("\n");

  // Credit card fatura has a "DATA ESTABELECIMENTO" section header
  if (full.includes("DATA") && full.includes("ESTABELECIMENTO")) {
    return parseFatura(pagesText);
  }

  const tableTx = parseTables(pages);
  if (tableTx.length > 0) return tableTx;

  return parseTextFallback(pagesText);
}

function parseFatura(pagesText: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  let year = new Date().getFullYear();

  for (const page of pagesText) {
    const y = findYear([page]);
    if (y) year = y;

    let inTxSection = false;
    let pendingDate: string | null = null;
    let pendingDesc = "";
    let pendingAmount: number | null = null;

    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      // Start of the transactions section
      if (line.includes("DATA") && line.includes("ESTABELECIMENTO")) {
        inTxSection = true;
        continue;
      }

      // End of the section (subtotal lines). Matched against whitespace-stripped
      // text: pdf.js's line reconstruction inserts spaces at column boundaries
      // that pdfplumber (which this pattern was written against) collapses —
      // without this, the section never closes and garbage from unrelated
      // sections later on the page gets appended to the last pending row.
      if (inTxSection && STOP_SECTION_RE.test(line.replace(/\s+/g, ""))) {
        flush(transactions, pendingDate, pendingDesc, pendingAmount);
        pendingDate = null;
        pendingDesc = "";
        pendingAmount = null;
        inTxSection = false;
        continue;
      }

      if (!inTxSection) continue;

      const m = line.match(TX_START_RE);
      if (m) {
        flush(transactions, pendingDate, pendingDesc, pendingAmount);

        const [, dateStr, rest] = m;
        const amounts = findAllAmounts(rest);
        if (amounts.length > 0) {
          pendingAmount = parseBrAmount(amounts[0]);
          const cut = rest.indexOf(amounts[0]);
          pendingDesc = rest.slice(0, cut).trim();
        } else {
          pendingDesc = rest.trim();
          pendingAmount = null;
        }

        const [dd, mm] = dateStr.split("/");
        pendingDate = parseBrDate(Number(dd), Number(mm), year);
      } else if (pendingDate) {
        // Continuation line: take only ALL-CAPS words before the first
        // lowercase token — mixed-case words are right-column artifacts.
        const cleanWords: string[] = [];
        for (const w of line.split(/\s+/)) {
          if (AMOUNT_FULL_RE.test(w)) break; // amount - right column
          if (/[a-z]/.test(w)) break; // camelCase compressed text - right column
          cleanWords.push(w);
        }
        if (cleanWords.length > 0) {
          pendingDesc = (pendingDesc + " " + cleanWords.join(" ")).trim();
        }
      }
    }

    flush(transactions, pendingDate, pendingDesc, pendingAmount);
  }

  return transactions;
}

function flush(transactions: Transaction[], date: string | null, desc: string, amount: number | null) {
  if (date && amount && amount > 0) {
    const cleaned = (desc || "Transaction").replace(/^[ \-•]+|[ \-•]+$/g, "");
    transactions.push({ date, description: cleaned, amount });
  }
}

// No ruling-line table extraction is available client/server-side in Node, so
// "table rows" are approximated as reconstructed text lines (same y-clustering
// the pdf.js highlighter uses) — sufficient here since every row this parser
// reads collapses to a single joined string anyway.
function parseTables(pages: PdfPage[]): Transaction[] {
  const transactions: Transaction[] = [];
  for (const page of pages) {
    for (const line of page.lines) {
      const txn = rowToTransaction(lineText(line).trim());
      if (txn) transactions.push(txn);
    }
  }
  return transactions;
}

function parseTextFallback(pagesText: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  for (const page of pagesText) {
    for (const rawLine of page.split("\n")) {
      const txn = rowToTransaction(rawLine.trim());
      if (txn) transactions.push(txn);
    }
  }
  return transactions;
}

function rowToTransaction(raw: string): Transaction | null {
  const m = raw.match(DATE_SLASH_RE);
  if (!m) return null;

  const txnDate = parseBrDate(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined);
  if (!txnDate) return null;

  let amount: number | null;
  const mAmt = raw.match(DEBIT_CREDIT_RE);
  if (mAmt) {
    amount = parseBrAmount(mAmt[1]);
  } else {
    const amounts = findAllAmounts(raw);
    amount = amounts.length > 0 ? parseBrAmount(amounts[amounts.length - 1]) : null;
  }

  if (!amount || amount <= 0) return null;

  const desc = cleanDescription(raw);
  return desc ? { date: txnDate, description: desc, amount } : null;
}

function cleanDescription(text: string): string {
  let cleaned = text.replace(new RegExp(DATE_SLASH_RE.source, "g"), "");
  cleaned = cleaned.replace(new RegExp(DEBIT_CREDIT_RE.source, "g"), "");
  cleaned = cleaned.replace(new RegExp(AMOUNT_RE.source, "g"), "");
  cleaned = cleaned.replace(/\b[DC]\b/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.replace(/^[ ·\-]+|[ ·\-]+$/g, "");
}
