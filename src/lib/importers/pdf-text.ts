import { groupLines, lineText, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";

export interface PdfPage {
  text: string;
  lines: PdfLine[];
}

export async function extractPages(data: Buffer | Uint8Array): Promise<PdfPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdf.js rejects Node's Buffer (a Uint8Array subclass, but wrong constructor)
  // and detaches whatever ArrayBuffer it's given — always hand it a fresh copy
  // so the same source buffer can be parsed again by another importer.
  const bytes = new Uint8Array(data);
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });

  const pages: PdfPage[] = [];
  try {
    const doc = await loadingTask.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as PdfTextItem[];
      const lines = groupLines(items);
      pages.push({ text: lines.map(lineText).join("\n"), lines });
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}

export async function extractTextPages(data: Buffer | Uint8Array): Promise<string[]> {
  const pages = await extractPages(data);
  return pages.map((p) => p.text);
}
