// pdfjs-dist ships types for its main build only (legacy/build/pdf.d.mts) — the
// worker build has none. src/lib/importers/pdf-text.ts imports it to populate
// globalThis.pdfjsWorker; see the comment there for why.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
