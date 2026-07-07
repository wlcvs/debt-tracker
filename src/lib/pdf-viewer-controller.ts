"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import { groupLines, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";

export interface PageInfo {
  wrapperEl: HTMLDivElement;
  baseWidth: number;
  baseHeight: number;
  lines: PdfLine[];
  fitViewport: PageViewport;
}

export interface LoadResult {
  numPages: number;
  pageInfos: PageInfo[];
}

type PdfjsModule = typeof import("pdfjs-dist");

// Cached across calls so pdf-highlight.ts (browser-only geometry math that
// needs pdfjsLib.Util) can reuse the same loaded module without importing
// "pdfjs-dist" at module scope itself — a real (non-type-only) top-level
// import of it evaluates browser-only globals like DOMMatrix immediately,
// which crashes this component's server-side render pass.
let cachedPdfjsLib: PdfjsModule | null = null;
let workerConfigured = false;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!cachedPdfjsLib) {
    cachedPdfjsLib = await import("pdfjs-dist");
  }
  if (!workerConfigured) {
    cachedPdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  }
  return cachedPdfjsLib;
}

export function getLoadedPdfjs(): PdfjsModule | null {
  return cachedPdfjsLib;
}

// Kept as a plain class (not React state) on purpose — the PDF document
// proxy, per-page text items, and canvas elements are large/non-serializable
// and shouldn't be Proxy-wrapped or trigger re-renders. Hold an instance in a
// useRef, never useState.
export class PdfViewerController {
  private pdfDoc: PDFDocumentProxy | null = null;
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private loadToken = 0;
  private loadedUrl: string | null = null;
  pageInfos: PageInfo[] = [];

  async load(url: string, container: HTMLElement): Promise<LoadResult | null> {
    if (url && url === this.loadedUrl && this.pdfDoc) {
      return { numPages: this.pdfDoc.numPages, pageInfos: this.pageInfos };
    }

    const token = ++this.loadToken;
    this.clearState(container);
    if (!url) return null;

    const pdfjsLib = await loadPdfjs();
    const loadingTask = pdfjsLib.getDocument({ url });
    this.loadingTask = loadingTask;
    const doc = await loadingTask.promise;
    if (token !== this.loadToken) {
      this.safeDestroy(loadingTask);
      return null;
    }
    this.pdfDoc = doc;

    const pageInfos: PageInfo[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (token !== this.loadToken) {
        this.safeDestroy(loadingTask);
        this.pdfDoc = null;
        return null;
      }

      const viewport1 = page.getViewport({ scale: 1 });
      const fitScale = (container.clientWidth > 0 ? container.clientWidth : 700) / viewport1.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderViewport = page.getViewport({ scale: fitScale * dpr });

      const wrapper = document.createElement("div");
      wrapper.className = "relative mx-auto mb-3 bg-white shadow-sm";
      wrapper.style.width = `${renderViewport.width / dpr}px`;
      wrapper.style.height = `${renderViewport.height / dpr}px`;

      const canvas = document.createElement("canvas");
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.className = "block";
      wrapper.appendChild(canvas);
      container.appendChild(wrapper);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise;
      }
      if (token !== this.loadToken) {
        this.safeDestroy(loadingTask);
        this.pdfDoc = null;
        return null;
      }

      const textContent = await page.getTextContent();

      pageInfos.push({
        wrapperEl: wrapper,
        baseWidth: renderViewport.width / dpr,
        baseHeight: renderViewport.height / dpr,
        lines: groupLines(textContent.items as PdfTextItem[]),
        fitViewport: page.getViewport({ scale: fitScale }),
      });
    }

    if (token !== this.loadToken) {
      this.safeDestroy(loadingTask);
      this.pdfDoc = null;
      return null;
    }

    this.pageInfos = pageInfos;
    this.loadedUrl = url;
    return { numPages: doc.numPages, pageInfos };
  }

  setZoom(zoom: number): void {
    this.pageInfos.forEach((info) => {
      info.wrapperEl.style.width = `${info.baseWidth * zoom}px`;
      info.wrapperEl.style.height = `${info.baseHeight * zoom}px`;
    });
  }

  // Cancels any in-flight load and tears down the current document/DOM.
  clear(container?: HTMLElement): void {
    this.loadToken++;
    this.clearState(container);
  }

  private clearState(container?: HTMLElement): void {
    if (container) container.innerHTML = "";
    this.safeDestroy(this.loadingTask);
    this.loadingTask = null;
    this.pdfDoc = null;
    this.pageInfos = [];
    this.loadedUrl = null;
  }

  // Best-effort cleanup for a superseded/cancelled load — a document from an
  // aborted or already-torn-down load may not always be a full loading task.
  private safeDestroy(loadingTask: PDFDocumentLoadingTask | null): void {
    try {
      loadingTask?.destroy();
    } catch {
      // ignore
    }
  }
}
