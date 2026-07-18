// Itaú fatura extraction: transaction table only (billing slips and
// installment simulations are skipped) — ported from banks/itau.py.
import { extractPages } from "@/lib/importers/base";
import { lineText, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";
import { callLlm, type LlmCorrection, type LlmTransaction } from "./base";

const PROMPT_HINT =
  "\n\nItaú fatura transaction table (DATA | ESTABELECIMENTO | VALOR EM R$):\n" +
  "- First line is the header: DATA  ESTABELECIMENTO  VALOREMR$\n" +
  "- Transaction line: DD/MM  CODE  amount  (e.g. '27/03 DISTRIBUIDOR-CTEI03/03 156,68')\n" +
  "- Continuation line: merchant name on the next line (e.g. 'MORADIA.FRANCODAROC')\n" +
  "- Combine code + continuation as description.\n" +
  "- Skip: 'Lançamentosnocartão', 'LTotaldos', totals.";

const STOP_MARKERS = ["Totaldos", "LTotaldos", "Limitesdecr", "Fiqueaten"];

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const text = await transactionRows(pdfBytes);
  if (!text) return [[], ""];

  const txns = await callLlm(text, "Itaú", { extraHint: PROMPT_HINT, maxTokens: 512, corrections });
  return [txns, text];
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
