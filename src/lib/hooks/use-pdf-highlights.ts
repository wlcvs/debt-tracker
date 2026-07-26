"use client";

import { useEffect, useRef, useState } from "react";
import { PdfViewerController, type PageInfo } from "@/lib/pdf-viewer-controller";
import { buildHighlightRect, findMatches, pickBestMatch, type HighlightRect } from "@/lib/pdf-highlight";
import type { Txn } from "@/lib/import-modal-types";

export interface HighlightEntry {
  txnIndex: number | string;
  pageIdx: number;
  rect: HighlightRect;
}

interface Options {
  step: "upload" | "processing" | "review" | "saving";
  pdfSrc: string;
  currentTxns: Txn[];
  /** Fired after a highlight is resolved/created for a selected transaction —
   * lets the caller handle concerns that live outside this hook (scrolling
   * the transaction table's own row into view, switching the mobile view to
   * "pdf") without this hook needing to know about the table's ref. */
  onSelect?: (t: Txn) => void;
}

/**
 * Owns the PDF.js viewer instance and everything about matching transactions
 * to highlighted regions on the rendered pages. The PdfViewerController is
 * kept via useState(() => new PdfViewerController()) exactly as before —
 * never put it in a dependency array, it's a stable class instance, not
 * something React should re-create on re-render.
 */
export function usePdfHighlights({ step, pdfSrc, currentTxns, onSelect }: Options) {
  const [controller] = useState(() => new PdfViewerController());
  const containerRef = useRef<HTMLDivElement>(null);
  const claimedLineKeysRef = useRef<Set<string>>(new Set());

  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfNoMatch, setPdfNoMatch] = useState(false);
  const [selectedTxnIndex, setSelectedTxnIndex] = useState<number | string | null>(null);
  const [highlights, setHighlights] = useState<HighlightEntry[]>([]);
  const [pageInfoList, setPageInfoList] = useState<PageInfo[]>([]);

  // --- PDF loading ---------------------------------------------------------

  useEffect(() => {
    if (step !== "review" || !containerRef.current || !pdfSrc) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await controller.load(pdfSrc, containerRef.current!);
        if (cancelled || !result) return;
        controller.setZoom(pdfZoom);
        setPageInfoList(result.pageInfos);
        setPdfReady(true);
      } catch (e) {
        console.error("Falha ao carregar PDF:", e);
        if (!cancelled) setPdfReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // pdfZoom intentionally excluded — zoom changes are handled by the zoom effect, not a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pdfSrc]);

  // --- Highlights: recompute whenever the PDF is ready or the active data changes ---

  useEffect(() => {
    if (!pageInfoList.length) return;

    claimedLineKeysRef.current.clear();
    // Resets selection whenever the PDF geometry or the active transaction
    // set changes — tied to external state (pdf.js line matches), not
    // derivable from props/state alone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTxnIndex(null);

    const entries: HighlightEntry[] = [];
    currentTxns.forEach((t) => {
      const best = pickBestMatch(findMatches(t, pageInfoList), claimedLineKeysRef.current);
      if (!best) return;
      entries.push({ txnIndex: t.index, pageIdx: best.pageIdx, rect: buildHighlightRect(best, pageInfoList) });
    });
    setHighlights(entries);
  }, [pageInfoList, currentTxns]);

  function highlightTransaction(t: Txn) {
    if (!pdfReady) return;
    const pageInfos = pageInfoList;
    if (!pageInfos.length) return;

    let entry = highlights.find((h) => h.txnIndex === t.index);
    if (!entry) {
      const best = pickBestMatch(findMatches(t, pageInfos), claimedLineKeysRef.current);
      if (!best) {
        setPdfNoMatch(true);
        setTimeout(() => setPdfNoMatch(false), 2000);
        return;
      }
      entry = { txnIndex: t.index, pageIdx: best.pageIdx, rect: buildHighlightRect(best, pageInfos) };
      setHighlights((prev) => [...prev, entry!]);
    }
    setPdfNoMatch(false);
    setSelectedTxnIndex(t.index);

    const wrapperEl = pageInfos[entry.pageIdx]?.wrapperEl;
    const scrollContainer = containerRef.current;
    if (wrapperEl && scrollContainer) {
      const margin = 24;
      const highlightTop = wrapperEl.offsetTop + entry.rect.top * pdfZoom;
      const highlightBottom = highlightTop + entry.rect.height * pdfZoom;
      const viewTop = scrollContainer.scrollTop;
      const viewBottom = viewTop + scrollContainer.clientHeight;

      if (highlightTop < viewTop + margin) {
        scrollContainer.scrollTo({ top: highlightTop - margin, behavior: "smooth" });
      } else if (highlightBottom > viewBottom - margin) {
        scrollContainer.scrollTo({ top: highlightBottom - scrollContainer.clientHeight + margin, behavior: "smooth" });
      }
    }

    onSelect?.(t);
  }

  function zoomIn() {
    const z = Math.min(3, +(pdfZoom + 0.2).toFixed(2));
    setPdfZoom(z);
    controller.setZoom(z);
  }

  function zoomOut() {
    const z = Math.max(0.5, +(pdfZoom - 0.2).toFixed(2));
    setPdfZoom(z);
    controller.setZoom(z);
  }

  function reset() {
    controller.clear(containerRef.current ?? undefined);
    setPdfReady(false);
    setPdfZoom(1);
    setPdfNoMatch(false);
    setSelectedTxnIndex(null);
    setHighlights([]);
    setPageInfoList([]);
    claimedLineKeysRef.current.clear();
  }

  useEffect(() => {
    return () => {
      controller.clear();
    };
  }, [controller]);

  return {
    containerRef,
    pdfZoom,
    pdfReady,
    pdfNoMatch,
    selectedTxnIndex,
    highlights,
    pageInfoList,
    highlightTransaction,
    zoomIn,
    zoomOut,
    reset,
  };
}
