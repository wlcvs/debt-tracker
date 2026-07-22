// Bradesco extrato extraction: dates, descriptions and amounts are spread
// across separate, ambiguous lines in the raw PDF text, so we rule-based
// pre-process into clean 'YYYY-MM-DD DESCRIPTION AMOUNT' lines before calling
// the LLM (which just does a strict pass-through conversion to JSON — no
// interpretation needed). Ported from banks/bradesco.py.
import { extractTextPages } from "@/lib/importers/base";
import { extractChunked, type LLMCorrection, type LLMTransaction } from "./base";

const SYSTEM_PROMPT_OVERRIDE = `\
Convert each input line to a JSON object. Every line is a confirmed debit transaction — do NOT skip, filter, or deduplicate any of them.

Each line format: YYYY-MM-DD DESCRIPTION AMOUNT

- date: copy exactly as YYYY-MM-DD
- description: the text between the date and the last number on the line
- amount: the last number on the line, already in decimal format (e.g. 186.69), copy as a string with 2 decimal places

Output ONLY a valid JSON array:
[{"date":"2026-05-11","description":"PIX ENVIADO","amount":"186.69"},...]

Include ALL lines without exception.`;

const SKIP_RE = /TED-TRANSF ELET DISPON|PIX RECEBIDO|COD\. LANC\. 0|RENTAB\.INVEST/i;
const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const DATE_PREFIX_RE = /^(\d{2}\/\d{2}\/(\d{4}))\s*/;
const TYPE_LABEL_RE = /^[A-Z*][A-Z\s\-.*/]+$/;

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LLMCorrection[]
): Promise<[LLMTransaction[], string]> {
  const text = await cleanLines(pdfBytes);
  if (!text) return [[], ""];

  const lines = text.split("\n");
  // The LLM's job here is a strict pass-through JSON conversion of lines
  // that are already unambiguous — small models can still fabricate an
  // extra entry despite the "do NOT skip/filter/dedupe" instruction (seen
  // in practice: a duplicated amount under today's date), and can shuffle
  // values between lines once a call holds many of them at once.
  // extractChunked keeps each call small, retries a chunk whose response
  // doesn't cover all of its own lines, and whitelists against the real
  // pre-processed lines by date+amount.
  const filtered = await extractChunked(lines, "Bradesco", {
    systemOverride: SYSTEM_PROMPT_OVERRIDE,
    maxTokens: 2048,
    corrections,
  });

  return [filtered, text];
}

/**
 * Pre-process Bradesco extrato into unambiguous 'YYYY-MM-DD DESCRIPTION AMOUNT' lines.
 *
 * Entry structure (order in PDF):
 *   [date] TYPE_LABEL        — optional type label (may share line with date)
 *   [date] DocNum D1 D2      — amounts: second-to-last=debit, last=balance
 *   DES:/REMET.: name DD/MM  — recipient name (comes AFTER amounts)
 *
 * We buffer each pending entry and only emit when the next entry starts, so we
 * can capture the DES: that follows the amounts line.
 */
export async function cleanLines(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const pages = await extractTextPages(pdfBytes);
  const lines = pages.join("\n").split("\n");

  const sectionLines: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const stripped = line.trim();
    if (!inSection) {
      if (stripped.includes("Histórico") && stripped.includes("Débito")) inSection = true;
      continue;
    }
    if (stripped.includes("Saldo Final") || stripped.startsWith("S Saldo Final")) break;
    if (stripped) sectionLines.push(stripped);
  }

  const result: string[] = [];
  let currentDate: string | null = null;

  let pDate: string | null = null;
  let pType: string | null = null;
  let pDesc: string | null = null;
  let pDebit: string | null = null;
  let pSkip = false;
  let hasPending = false;

  const flush = () => {
    if (hasPending && !pSkip && pDebit && pDate) {
      const val = Number(pDebit.replace(/\./g, "").replace(",", "."));
      if (val > 0) {
        const [d, m, y] = pDate.split("/");
        const desc = pDesc || pType || "DÉBITO";
        result.push(`${y}-${m}-${d} ${desc} ${val.toFixed(2)}`);
      }
    }
    hasPending = false;
    pType = null;
    pDesc = null;
    pDebit = null;
    pSkip = false;
  };

  for (let line of sectionLines) {
    const dm = line.match(DATE_PREFIX_RE);
    if (dm) {
      currentDate = dm[1];
      line = line.slice(dm[0].length).trim();
    }

    if (!line) continue;

    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => m[1]);

    if (line.startsWith("Total") && amounts.length > 0) {
      flush();
      continue;
    }

    if (line.startsWith("DES:") || line.startsWith("REMET.") || line.startsWith("REM:")) {
      const raw = line.includes(":") ? line.split(":").slice(1).join(":") : line.slice(5);
      const desc = raw.replace(/\s+\d{2}\/\d{2}$/, "").trim();
      if (hasPending && pDesc === null) pDesc = desc;
      continue;
    }

    if (line.startsWith("CONTR") && amounts.length === 0) continue;

    if (amounts.length >= 2 && currentDate) {
      if (hasPending && pDebit === null) {
        if (SKIP_RE.test(line)) pSkip = true;
        pDebit = amounts[amounts.length - 2];
        pDate = currentDate;
      } else {
        flush();
        pDate = currentDate;
        pDebit = amounts[amounts.length - 2];
        pSkip = SKIP_RE.test(line);
        hasPending = true;
      }
      continue;
    }

    if (TYPE_LABEL_RE.test(line) && amounts.length === 0) {
      flush();
      pDate = currentDate;
      pType = line;
      pSkip = SKIP_RE.test(line);
      hasPending = true;
    }
  }

  flush();
  return result.join("\n");
}
