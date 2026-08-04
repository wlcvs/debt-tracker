import { groupLines, lineText, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";

export interface PdfPage {
  text: string;
  lines: PdfLine[];
  width: number;
}

let workerReady: Promise<void> | null = null;

// On Node, pdf.js always runs the worker on the main thread, and resolves it by
// dynamically importing the *relative* string "./pdf.worker.mjs". That specifier
// is computed at runtime, so Next's file tracer can't see it and never ships the
// worker into the Vercel function ("Setting up fake worker failed: Cannot find
// module .../pdf.worker.mjs") — production-only, since node_modules is complete
// locally. pdf.js checks globalThis.pdfjsWorker first, so importing the worker
// ourselves both satisfies that check and gives the tracer a literal specifier
// to follow. Must run before the first getDocument: pdf.js memoizes the lookup.
async function ensureWorker(): Promise<void> {
  workerReady ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((worker) => {
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  });
  await workerReady;
}

export async function extractPages(data: Buffer | Uint8Array): Promise<PdfPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await ensureWorker();

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
      const viewport = page.getViewport({ scale: 1 });
      pages.push({ text: lines.map(lineText).join("\n"), lines, width: viewport.width });
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
