"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { PageInfo } from "@/lib/pdf-viewer-controller";
import type { HighlightEntry } from "@/lib/hooks/use-pdf-highlights";
import type { Txn } from "@/lib/import-modal-types";

const HIGHLIGHT_BASE =
  "bg-zinc-400/30 dark:bg-zinc-300/20 border border-zinc-500/50 dark:border-zinc-400/40";
const HIGHLIGHT_SELECTED =
  "bg-zinc-700/40 dark:bg-zinc-100/30 border border-zinc-900/70 dark:border-white/70";

interface Props {
  mobileView: "list" | "pdf";
  containerRef: RefObject<HTMLDivElement | null>;
  pdfZoom: number;
  pdfReady: boolean;
  pdfNoMatch: boolean;
  selectedTxnIndex: number | string | null;
  highlights: HighlightEntry[];
  pageInfoList: PageInfo[];
  pdfSrc: string;
  currentTxns: Txn[];
  statementId: string | null;
  refreshing: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRunFreshLLM: () => void;
  onSelectTxn: (t: Txn) => void;
}

export function PdfViewerPane({
  mobileView,
  containerRef,
  pdfZoom,
  pdfReady,
  pdfNoMatch,
  selectedTxnIndex,
  highlights,
  pageInfoList,
  pdfSrc,
  currentTxns,
  statementId,
  refreshing,
  onZoomIn,
  onZoomOut,
  onRunFreshLLM,
  onSelectTxn,
}: Props) {
  return (
    <div className={`${mobileView === "pdf" ? "flex" : "hidden"} lg:flex flex-1 flex-col min-h-0`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <button onClick={onZoomOut} disabled={!pdfReady} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
          −
        </button>
        <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400 w-9 text-center">{Math.round(pdfZoom * 100)}%</span>
        <button onClick={onZoomIn} disabled={!pdfReady} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
          +
        </button>
        {pdfNoMatch && (
          <p className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Não encontrado no PDF</p>
        )}
        <span className="flex-1" />
        {statementId && (
          <button onClick={onRunFreshLLM} disabled={refreshing} className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap">
            {refreshing ? "Analisando…" : "Nova análise"}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative bg-zinc-200 dark:bg-zinc-800">
        <div ref={containerRef} className="absolute inset-0 overflow-auto p-3" style={{ display: pdfSrc ? "block" : "none" }}>
          {pageInfoList.map((info, pageIdx) =>
            createPortal(
              <>
                {highlights
                  .filter((h) => h.pageIdx === pageIdx)
                  .map((h) => (
                    <div
                      key={h.txnIndex}
                      className={`absolute cursor-pointer transition-colors ${h.txnIndex === selectedTxnIndex ? HIGHLIGHT_SELECTED : HIGHLIGHT_BASE}`}
                      style={{
                        left: h.rect.left * pdfZoom,
                        top: h.rect.top * pdfZoom,
                        width: h.rect.width * pdfZoom,
                        height: h.rect.height * pdfZoom,
                      }}
                      onClick={() => {
                        const t = currentTxns.find((tx) => tx.index === h.txnIndex);
                        if (t) onSelectTxn(t);
                      }}
                    />
                  ))}
              </>,
              info.wrapperEl
            )
          )}
        </div>
        {pdfSrc && !pdfReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-zinc-400 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
          </div>
        )}
        {!pdfSrc && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600">PDF não disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}
