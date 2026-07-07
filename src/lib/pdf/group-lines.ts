export interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
}

export interface PdfLine {
  y: number;
  items: PdfTextItem[];
}

const Y_TOLERANCE = 2;

export function groupLines(items: PdfTextItem[]): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
  const lines: PdfLine[] = [];

  for (const item of sorted) {
    const y = item.transform[5];
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= Y_TOLERANCE) {
      last.items.push(item);
    } else {
      lines.push({ y, items: [item] });
    }
  }

  lines.forEach((line) => line.items.sort((a, b) => a.transform[4] - b.transform[4]));
  return lines;
}

// Gap (in PDF points) beyond which two adjacent text runs are treated as
// separate words and joined with a space. pdf.js does not synthesize spaces
// for positional gaps the way pdfplumber's extract_text() does — without
// this, a description ending right before a far-right amount column (or any
// two words split into separate runs) glues together with no separator.
// Runs split mid-word by kerning sit at ~0 gap and stay glued, matching the
// existing highlighter's kerning-split fallback.
const WORD_GAP_THRESHOLD = 1;

export function lineText(line: PdfLine): string {
  let text = "";
  let prevEndX: number | null = null;

  for (const item of line.items) {
    const x = item.transform[4];
    if (prevEndX !== null && x - prevEndX > WORD_GAP_THRESHOLD) {
      text += " ";
    }
    text += item.str;
    prevEndX = x + (item.width ?? 0);
  }

  return text;
}
