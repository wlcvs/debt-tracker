// Itaú fatura extraction: transaction table only (billing slips and
// installment simulations are skipped) — ported from banks/itau.py.
import { AMOUNT_FULL_RE, TX_START_RE } from "@/lib/importers/itau";
import { extractPages, findAllAmounts, findYear, parseBrAmount, parseBrDate } from "@/lib/importers/base";
import { lineText, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";
import { extractChunked, type LlmCorrection, type LlmTransaction } from "./base";

const STOP_MARKERS = ["Totaldos", "LTotaldos", "Limitesdecr", "Fiqueaten"];

// Strict pass-through prompt, mirroring bradesco.ts: dates/amounts are already
// computed deterministically in cleanRows(), so the LLM's only job is copying
// already-unambiguous lines forward — no year math, no column-merge judgment.
const SYSTEM_PROMPT_OVERRIDE = `\
Convert each input line to a JSON object. Every line is a confirmed Itaú fatura transaction from the DATA/ESTABELECIMENTO table — do NOT skip, filter, or deduplicate any of them.

Each line format: YYYY-MM-DD DESCRIPTION AMOUNT

- date: copy exactly as YYYY-MM-DD
- description: the text between the date and the last number on the line
- amount: the last number on the line, already in decimal format (e.g. 156.68), copy as a string with 2 decimal places

Output ONLY a valid JSON array:
[{"date":"2026-03-27","description":"DISTRIBUIDOR-CTEI03/03 MORADIA.FRANCODAROC","amount":"156.68"}]

Include ALL lines without exception.`;

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const text = await cleanRows(pdfBytes);
  if (!text) return [[], ""];

  const lines = text.split("\n");
  const filtered = await extractChunked(lines, "Itaú", {
    systemOverride: SYSTEM_PROMPT_OVERRIDE,
    maxTokens: 512,
    corrections,
  });
  return [filtered, text];
}

/**
 * Pre-process the DATA/ESTABELECIMENTO table into unambiguous
 * 'YYYY-MM-DD DESCRIPTION AMOUNT' lines, deterministically in code — no LLM
 * involved. Mirrors importers/itau.ts's parseFatura() continuation-line
 * buffering (kept as a separate, deliberately similar implementation rather
 * than one shared function, since the two want different output shapes —
 * Transaction[] vs. clean-line strings — keep the two in sync if either
 * changes).
 */
export async function cleanRows(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const rows = await transactionRows(pdfBytes);
  if (!rows) return "";

  const pages = await extractPages(pdfBytes);
  const year = findYear(pages.map((p) => p.text)) ?? new Date().getFullYear();

  const lines = rows.split("\n").slice(1); // drop the DATA/ESTABELECIMENTO header row
  const out: string[] = [];
  let pendingDate: string | null = null;
  let pendingDesc = "";
  let pendingAmount: string | null = null;

  const flush = () => {
    if (pendingDate && pendingAmount) {
      out.push(`${pendingDate} ${(pendingDesc.trim() || "Transação").replace(/^[ \-•]+|[ \-•]+$/g, "")} ${pendingAmount}`);
    }
    pendingDesc = "";
    pendingAmount = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = line.match(TX_START_RE);
    if (m) {
      flush();
      const [, dateStr, rest] = m;
      const amounts = findAllAmounts(rest);
      if (amounts.length > 0) {
        const amount = parseBrAmount(amounts[0]);
        pendingAmount = amount !== null && amount > 0 ? amount.toFixed(2) : null;
        pendingDesc = rest.slice(0, rest.indexOf(amounts[0])).trim();
      } else {
        pendingDesc = rest.trim();
        pendingAmount = null;
      }

      const [dd, mm] = dateStr.split("/");
      pendingDate = parseBrDate(Number(dd), Number(mm), year);
    } else if (pendingDate) {
      // Continuation line: same ALL-CAPS-before-lowercase rule as the algo parser.
      const cleanWords: string[] = [];
      for (const w of line.split(/\s+/)) {
        if (AMOUNT_FULL_RE.test(w)) break;
        if (/[a-z]/.test(w)) break;
        cleanWords.push(w);
      }
      if (cleanWords.length > 0) {
        pendingDesc = (pendingDesc + " " + cleanWords.join(" ")).trim();
      }
    }
  }
  flush();

  return out.join("\n");
}

/**
 * Find the page with the DATA/ESTABELECIMENTO header and extract only the
 * left column (below the 60%-page-width split) from that header down to the
 * totals line. Pages that are billing slips/simulations never match and are
 * skipped.
 */
export async function transactionRows(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const pages = await extractPages(pdfBytes);

  for (const page of pages) {
    const headerLine = page.lines.find((line) => {
      const t = lineText(line);
      return t.includes("DATA") && t.includes("ESTABELECIMENTO");
    });
    if (!headerLine) continue;

    const splitX = page.width * 0.6;
    const lines: string[] = [];
    let inTable = false;

    for (const line of page.lines) {
      const leftItems: PdfTextItem[] = line.items.filter((item) => item.transform[4] <= splitX);
      if (leftItems.length === 0) continue;

      const filtered: PdfLine = { y: line.y, items: leftItems };
      const rowText = lineText(filtered);

      if (!inTable) {
        if (rowText.includes("DATA") && rowText.includes("ESTABELECIMENTO")) {
          inTable = true;
          lines.push(rowText);
        }
        continue;
      }

      if (STOP_MARKERS.some((marker) => rowText.replace(/\s+/g, "").includes(marker))) {
        break;
      }

      lines.push(rowText);
    }

    if (lines.length > 0) return lines.join("\n");
  }

  return "";
}
