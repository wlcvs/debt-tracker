"use client";

import { useCallback, useRef, useState } from "react";
import { useDismiss, useDismissGuard } from "@/lib/hooks/use-dismiss";
import { useImportFlow } from "@/lib/hooks/use-import-flow";
import { usePdfHighlights } from "@/lib/hooks/use-pdf-highlights";
import { FilterToolbar } from "@/components/filter-toolbar";
import { TransactionTable } from "@/components/transaction-table";
import { PdfViewerPane } from "@/components/pdf-viewer-pane";
import { ManualAddDialog } from "@/components/manual-add-dialog";
import type { Txn } from "@/lib/import-modal-types";

interface Props {
  people: { id: string; name: string }[];
  reopenStatementId: string | null;
  cameFromStatements: boolean;
  onClose: () => void;
  onBackToStatements: () => void;
}

export function ImportModal({ people, reopenStatementId, cameFromStatements, onClose, onBackToStatements }: Props) {
  const [localPeople, setLocalPeople] = useState(people);

  const [mobileView, setMobileView] = useState<"list" | "pdf">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");

  const [showManualAdd, setShowManualAdd] = useState(false);
  const [editingDescIndex, setEditingDescIndex] = useState<number | string | null>(null);

  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const { suppressNext: suppressNextDismiss, guard: guardDismiss } = useDismissGuard();

  const {
    step,
    bank,
    currentTxns,
    error,
    statementId,
    pdfSrc,
    refreshing,
    patchCurrentTxn,
    addManualTxn,
    handleClose,
    handleDrop,
    handleFile,
    runFreshLLM,
    save,
  } = useImportFlow({
    reopenStatementId,
    cameFromStatements,
    onClose,
    onBackToStatements,
  });

  const pdf = usePdfHighlights({
    step,
    pdfSrc,
    currentTxns,
    onSelect: (t) => {
      setMobileView("pdf");
      const rowEl = tableBodyRef.current?.querySelector(`tr[data-txn-index="${CSS.escape(String(t.index))}"]`);
      rowEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
  });

  function setSort(key: "date" | "amount") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  function openManualAdd() {
    setShowManualAdd(true);
  }

  function handleAddManualTxn(txn: Txn) {
    addManualTxn(txn);
  }

  // Explicit close paths (Fechar, Cancelar, Escape/backdrop) reset this
  // component's own view/filter state and usePdfHighlights' state before
  // handing off to useImportFlow's own handleClose — defensive, matching
  // the original single-component reset() exactly. Not strictly required
  // for correctness (ImportModal fully unmounts on close either way, per
  // statement-import-launcher.tsx's conditional render, so React would
  // discard this state regardless), but kept to avoid relying on that
  // unmount timing as a silent invariant.
  function closeModal() {
    setShowFilters(false);
    setShowManualAdd(false);
    setSortKey("date");
    setSortDir("asc");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setMobileView("list");
    pdf.reset();
    handleClose();
  }

  const dismissModal = useCallback(() => {
    guardDismiss(() => {
      if (editingDescIndex !== null) {
        setEditingDescIndex(null);
      } else {
        closeModal();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDescIndex]);
  useDismiss(null, dismissModal, { outsideClick: false });

  return (
    <div className="fixed inset-0 z-50 flex p-0 lg:p-6" style={{ alignItems: step === "review" ? "stretch" : "center", justifyContent: step === "review" ? undefined : "center", padding: step === "review" ? undefined : "1rem" }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismissModal} />

      <div
        className={`relative flex flex-col bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 ${
          step === "review" ? "w-full h-full" : "w-full max-w-lg"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Importar extrato</p>
            {bank && (
              <p className="text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 mt-0.5">{bank}</p>
            )}
          </div>
          <button onClick={closeModal} className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            Fechar
          </button>
        </div>

        {/* Step: upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            {error && <p className="text-xs text-red-500 dark:text-red-400 tracking-wider text-center">{error}</p>}
            <label
              className="w-full max-w-sm flex flex-col items-center gap-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 px-8 py-12 cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input type="file" accept=".pdf" className="sr-only" onChange={handleFile} />
              <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 text-center">
                Arraste o PDF aqui
                <br />
                <span className="text-zinc-400 dark:text-zinc-600 normal-case tracking-normal text-[10px] mt-1 block">
                  ou clique para selecionar
                </span>
              </p>
            </label>
          </div>
        )}

        {/* Step: processing */}
        {step === "processing" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
              <p className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Processando PDF…</p>
            </div>
          </div>
        )}

        {/* Step: review */}
        {(step === "review" || step === "saving") && (
          <div className="relative flex-1 flex flex-col min-h-0">
            <FilterToolbar
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              search={search}
              setSearch={setSearch}
              filterDateFrom={filterDateFrom}
              setFilterDateFrom={setFilterDateFrom}
              filterDateTo={filterDateTo}
              setFilterDateTo={setFilterDateTo}
              filterAmountMin={filterAmountMin}
              setFilterAmountMin={setFilterAmountMin}
              filterAmountMax={filterAmountMax}
              setFilterAmountMax={setFilterAmountMax}
              sortKey={sortKey}
              sortDir={sortDir}
              setSort={setSort}
              onOpenManualAdd={openManualAdd}
              currentTxnsCount={currentTxns.length}
            />

            {/* Mobile view switcher */}
            <div className="flex lg:hidden gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className={`flex-1 text-xs tracking-widest uppercase py-2 border transition-colors cursor-pointer ${
                  mobileView === "list"
                    ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                Lista
              </button>
              <button
                type="button"
                onClick={() => setMobileView("pdf")}
                className={`flex-1 text-xs tracking-widest uppercase py-2 border transition-colors cursor-pointer ${
                  mobileView === "pdf"
                    ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                PDF
              </button>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* LEFT: table */}
              <div
                className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex w-full lg:w-[42%] flex-col min-h-0 border-r border-zinc-200 dark:border-zinc-800`}
              >
                <TransactionTable
                  currentTxns={currentTxns}
                  localPeople={localPeople}
                  setLocalPeople={setLocalPeople}
                  patchCurrentTxn={patchCurrentTxn}
                  selectedTxnIndex={pdf.selectedTxnIndex}
                  onSelectTxn={pdf.highlightTransaction}
                  editingDescIndex={editingDescIndex}
                  setEditingDescIndex={setEditingDescIndex}
                  suppressNextDismiss={suppressNextDismiss}
                  tableBodyRef={tableBodyRef}
                  search={search}
                  filterDateFrom={filterDateFrom}
                  filterDateTo={filterDateTo}
                  filterAmountMin={filterAmountMin}
                  filterAmountMax={filterAmountMax}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  step={step}
                  onClose={closeModal}
                  onSave={save}
                />
              </div>

              {/* RIGHT: PDF viewer */}
              <PdfViewerPane
                mobileView={mobileView}
                containerRef={pdf.containerRef}
                pdfZoom={pdf.pdfZoom}
                pdfReady={pdf.pdfReady}
                pdfNoMatch={pdf.pdfNoMatch}
                selectedTxnIndex={pdf.selectedTxnIndex}
                highlights={pdf.highlights}
                pageInfoList={pdf.pageInfoList}
                pdfSrc={pdfSrc}
                currentTxns={currentTxns}
                statementId={statementId}
                refreshing={refreshing}
                onZoomIn={pdf.zoomIn}
                onZoomOut={pdf.zoomOut}
                onRunFreshLLM={runFreshLLM}
                onSelectTxn={pdf.highlightTransaction}
              />
            </div>

            {showManualAdd && (
              <ManualAddDialog bank={bank} onClose={() => setShowManualAdd(false)} onAdd={handleAddManualTxn} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
