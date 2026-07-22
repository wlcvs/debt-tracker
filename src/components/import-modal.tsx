"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  importStatement,
  reopenStatement,
  saveImportedTransactions,
  saveLLMFeedback,
} from "@/lib/actions/statement";
import { PdfViewerController, type PageInfo } from "@/lib/pdf-viewer-controller";
import { buildHighlightRect, findMatches, pickBestMatch, type HighlightRect } from "@/lib/pdf-highlight";

const HIGHLIGHT_BASE =
  "bg-zinc-400/30 dark:bg-zinc-300/20 border border-zinc-500/50 dark:border-zinc-400/40";
const HIGHLIGHT_SELECTED =
  "bg-zinc-700/40 dark:bg-zinc-100/30 border border-zinc-900/70 dark:border-white/70";

type TxnType = "ignore" | "debt" | "payment";

interface Txn {
  index: number | string;
  date: string;
  description: string;
  amount: number | string;
  personId: string;
  type: TxnType;
  manual?: boolean;
  title?: string;
  notes?: string;
}

interface HighlightEntry {
  txnIndex: number | string;
  pageIdx: number;
  rect: HighlightRect;
}

interface Props {
  people: { id: string; name: string }[];
  reopenStatementId: string | null;
  cameFromStatements: boolean;
  onClose: () => void;
  onBackToStatements: () => void;
}

function formatAmount(s: number | string): string {
  return parseFloat(String(s)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ImportModal({ people, reopenStatementId, cameFromStatements, onClose, onBackToStatements }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<"upload" | "processing" | "review" | "saving">("upload");
  const [bank, setBank] = useState("");
  const [algoTxns, setAlgoTxns] = useState<Txn[]>([]);
  const [LLMTxns, setLLMTxns] = useState<Txn[]>([]);
  const [error, setError] = useState("");
  const [statementId, setStatementId] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");

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
  const [manualDate, setManualDate] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfNoMatch, setPdfNoMatch] = useState(false);
  const [selectedTxnIndex, setSelectedTxnIndex] = useState<number | string | null>(null);
  const [editingDescIndex, setEditingDescIndex] = useState<number | string | null>(null);
  const [editingDescValue, setEditingDescValue] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [highlights, setHighlights] = useState<HighlightEntry[]>([]);
  const [pageInfoList, setPageInfoList] = useState<PageInfo[]>([]);

  const [controller] = useState(() => new PdfViewerController());
  const containerRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const claimedLineKeysRef = useRef<Set<string>>(new Set());
  const pdfBlobUrlRef = useRef("");
  useEffect(() => {
    pdfBlobUrlRef.current = pdfBlobUrl;
  }, [pdfBlobUrl]);

  const currentTxns = LLMTxns.length ? LLMTxns : algoTxns;
  const pdfSrc = pdfBlobUrl || (statementId ? `/api/statements/${statementId}/pdf` : "");

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = filterAmountMin !== "" ? parseFloat(filterAmountMin) : null;
    const amtMax = filterAmountMax !== "" ? parseFloat(filterAmountMax) : null;

    let txns = currentTxns;
    if (q) {
      txns = txns.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.date.includes(q) ||
          formatAmount(t.amount).includes(q)
      );
    }
    if (filterDateFrom) txns = txns.filter((t) => t.date >= filterDateFrom);
    if (filterDateTo) txns = txns.filter((t) => t.date <= filterDateTo);
    if (amtMin !== null) txns = txns.filter((t) => Math.abs(parseFloat(String(t.amount))) >= amtMin);
    if (amtMax !== null) txns = txns.filter((t) => Math.abs(parseFloat(String(t.amount))) <= amtMax);

    return [...txns].sort((a, b) => {
      let av: string | number = sortKey === "amount" ? parseFloat(String(a.amount)) : a[sortKey];
      let bv: string | number = sortKey === "amount" ? parseFloat(String(b.amount)) : b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [currentTxns, search, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, sortKey, sortDir]);

  const readyTxns = useMemo(() => currentTxns.filter((t) => t.type !== "ignore" && t.personId), [currentTxns]);
  const readyCount = readyTxns.length;
  const readyTotal = useMemo(
    () => readyTxns.reduce((sum, t) => sum + Math.abs(parseFloat(String(t.amount)) || 0), 0),
    [readyTxns]
  );

  function setSort(key: "date" | "amount") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  function updateTxn(list: "algo" | "LLM", index: number | string, patch: Partial<Txn>) {
    const setter = list === "algo" ? setAlgoTxns : setLLMTxns;
    setter((prev) => prev.map((t) => (t.index === index ? { ...t, ...patch } : t)));
  }

  // currentTxns comes from LLMTxns when non-empty, else algoTxns — find which
  // list a given row actually lives in so edits land on the right one.
  function patchCurrentTxn(index: number | string, patch: Partial<Txn>) {
    if (LLMTxns.length) updateTxn("LLM", index, patch);
    else updateTxn("algo", index, patch);
  }

  function startEditingDesc(t: Txn) {
    setEditingDescIndex(t.index);
    setEditingDescValue(t.description);
  }

  function commitEditingDesc(index: number | string) {
    setEditingDescIndex(null);
    const trimmed = editingDescValue.trim();
    if (trimmed) patchCurrentTxn(index, { description: trimmed });
  }

  function reset() {
    controller.clear(containerRef.current ?? undefined);
    if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
    setPdfBlobUrl("");
    setStatementId(null);
    setShowFilters(false);
    setStep("upload");
    setBank("");
    setAlgoTxns([]);
    setLLMTxns([]);
    setError("");
    setShowManualAdd(false);
    setManualDate("");
    setManualTitle("");
    setManualNotes("");
    setManualAmount("");
    setSortKey("date");
    setSortDir("asc");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setPdfReady(false);
    setPdfZoom(1);
    setPdfNoMatch(false);
    setSelectedTxnIndex(null);
    setHighlights([]);
    setPageInfoList([]);
    setMobileView("list");
    claimedLineKeysRef.current.clear();
  }

  function handleClose() {
    const backToStatements = cameFromStatements;
    reset();
    onClose();
    if (backToStatements) onBackToStatements();
  }

  interface ImportResultLike {
    bank: string;
    algorithm: Record<string, unknown>[];
    LLM: Record<string, unknown>[];
    statementId: string;
    cached?: boolean;
  }

  function loadData(data: ImportResultLike) {
    setBank(data.bank);
    setAlgoTxns(
      data.algorithm.map((t, i) => ({ ...t, index: i, personId: "", type: "ignore" }) as unknown as Txn)
    );
    setLLMTxns(data.LLM.map((t, i) => ({ ...t, index: i, personId: "", type: "ignore" }) as unknown as Txn));
    setStatementId(data.statementId);
    setStep("review");
  }

  async function processFile(file: File) {
    if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
    setPdfBlobUrl(URL.createObjectURL(file));
    setStatementId(null);
    setStep("processing");
    setError("");

    const fd = new FormData();
    fd.append("pdf", file);

    try {
      const data = await importStatement(fd);
      if (!data.algorithm.length && !data.LLM.length) {
        throw new Error("Nenhuma transação encontrada neste PDF.");
      }
      loadData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar o PDF.");
      setStep("upload");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function reopenSaved(id: string) {
    setStep("processing");
    setBank("");
    setError("");
    try {
      const data = await reopenStatement(id, {});
      loadData({ ...data, statementId: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reabrir extrato.");
      setStep("upload");
    }
  }

  async function runFreshLLM() {
    if (!statementId) return;
    setRefreshing(true);
    try {
      const data = await reopenStatement(statementId, { fresh: true });
      loadData({ ...data, statementId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao analisar.");
    } finally {
      setRefreshing(false);
    }
  }

  async function save() {
    setStep("saving");
    const items = currentTxns
      .filter((t) => t.type !== "ignore" && t.personId)
      .map((t) => ({
        type: t.type,
        personId: t.personId,
        amount: t.amount,
        date: t.date,
        title: t.title ?? t.description,
        description: t.description,
        notes: t.notes ?? "",
      }));

    try {
      await saveImportedTransactions(items);
      router.refresh();
      handleClose();
    } catch {
      setStep("review");
    }
  }

  function openManualAdd() {
    setManualDate("");
    setManualTitle("");
    setManualNotes("");
    setManualAmount("");
    setShowManualAdd(true);
  }

  async function confirmManualAdd() {
    if (!manualDate || !manualTitle || !manualAmount) return;

    const newTxn: Txn = {
      index: `manual_${Date.now()}`,
      date: manualDate,
      description: manualTitle,
      title: manualTitle,
      notes: manualNotes,
      amount: parseFloat(manualAmount).toFixed(2),
      personId: "",
      type: "debt",
      manual: true,
    };

    setLLMTxns((prev) => [...prev, newTxn]);
    setShowManualAdd(false);

    try {
      await saveLLMFeedback(bank, [{ date: manualDate, description: manualTitle, amount: manualAmount, context: "" }]);
    } catch (e) {
      console.error("Failed to save correction:", e);
    }
  }

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
    setMobileView("pdf");

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

    const rowEl = tableBodyRef.current?.querySelector(`tr[data-txn-index="${CSS.escape(String(t.index))}"]`);
    rowEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  // --- Reopen-on-mount (launched from the statements modal) ----------------

  const reopenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (reopenStatementId && reopenedRef.current !== reopenStatementId) {
      reopenedRef.current = reopenStatementId;
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setStatementId(reopenStatementId);
      reopenSaved(reopenStatementId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenStatementId]);

  useEffect(() => {
    return () => {
      controller.clear();
      if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
    };
  }, [controller]);

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex p-0 lg:p-6" style={{ alignItems: step === "review" ? "stretch" : "center", justifyContent: step === "review" ? undefined : "center", padding: step === "review" ? undefined : "1rem" }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

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
          <button onClick={handleClose} className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
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
                <div className="flex-1 overflow-auto">
                  <table className="w-full min-w-140 lg:min-w-0 text-xs border-collapse" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: 90 }} />
                      <col />
                      <col style={{ width: 88 }} />
                      <col style={{ width: 140 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-[#f0f0f4] dark:bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="text-left pl-3 pr-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">Data</th>
                        <th className="text-left px-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Descrição</th>
                        <th className="text-left pl-1 pr-3 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">Valor</th>
                        <th className="text-left px-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Devedor</th>
                        <th className="text-left pl-1 pr-3 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Tipo</th>
                      </tr>
                    </thead>
                    <tbody ref={tableBodyRef}>
                      {filteredTransactions.map((t) => (
                        <tr
                          key={t.index}
                          data-txn-index={t.index}
                          className={`border-b border-zinc-100 dark:border-zinc-800/60 transition-all cursor-pointer ${t.type === "ignore" ? "opacity-30" : ""} ${
                            t.index === selectedTxnIndex ? "bg-zinc-300/60 dark:bg-zinc-700/50" : ""
                          }`}
                          onClick={() => highlightTransaction(t)}
                        >
                          <td className="pl-3 pr-1 py-1.5 tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-[11px]">{t.date}</td>
                          <td className="px-1 py-1.5 text-zinc-900 dark:text-zinc-100 overflow-hidden">
                            {editingDescIndex === t.index ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingDescValue}
                                onChange={(e) => setEditingDescValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={() => commitEditingDesc(t.index)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingDescIndex(null);
                                  }
                                }}
                                className="w-full bg-transparent border-b border-zinc-400 dark:border-zinc-500 text-[11px] text-zinc-900 dark:text-zinc-100 focus:outline-none"
                              />
                            ) : (
                              <span
                                className="block truncate text-[11px]"
                                title={t.description}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingDesc(t);
                                }}
                              >
                                {t.description}
                              </span>
                            )}
                            {t.manual && <span className="text-[9px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">manual</span>}
                          </td>
                          <td className="pl-1 pr-3 py-1.5 text-left tabular-nums text-zinc-900 dark:text-zinc-100 whitespace-nowrap text-[11px]">
                            R${formatAmount(t.amount)}
                          </td>
                          <td className="px-1 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.personId}
                              onChange={(e) => {
                                const personId = e.target.value;
                                patchCurrentTxn(t.index, { personId, type: personId && t.type === "ignore" ? "debt" : t.type });
                              }}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-1 py-0.5 text-[10px] tracking-wider text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                            >
                              <option value="">—</option>
                              {people.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="pl-1 pr-3 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.type}
                              onChange={(e) => {
                                const type = e.target.value as TxnType;
                                patchCurrentTxn(t.index, { type, personId: type === "ignore" ? "" : t.personId });
                              }}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-1 py-0.5 text-[10px] tracking-wider text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                            >
                              <option value="ignore">Ignorar</option>
                              <option value="debt">Dívida</option>
                              <option value="payment">Pgto</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
                            Nenhuma transação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                  <p className="text-[10px] tracking-wider text-zinc-500 dark:text-zinc-400">
                    {readyCount} prontos
                    {readyCount > 0 && <> · R$ {formatAmount(readyTotal)}</>}
                  </p>
                  <div className="flex gap-3 items-center">
                    <button onClick={handleClose} className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                      Cancelar
                    </button>
                    <button
                      onClick={save}
                      disabled={readyCount === 0 || step === "saving"}
                      className={`border px-4 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
                        readyCount > 0
                          ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white"
                          : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                      }`}
                    >
                      {step === "saving" ? "Salvando…" : "Importar"}
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT: PDF viewer */}
              <div className={`${mobileView === "pdf" ? "flex" : "hidden"} lg:flex flex-1 flex-col min-h-0`}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                  <button onClick={zoomOut} disabled={!pdfReady} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    −
                  </button>
                  <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400 w-9 text-center">{Math.round(pdfZoom * 100)}%</span>
                  <button onClick={zoomIn} disabled={!pdfReady} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    +
                  </button>
                  {pdfNoMatch && (
                    <p className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Não encontrado no PDF</p>
                  )}
                  <span className="flex-1" />
                  {statementId && (
                    <button onClick={runFreshLLM} disabled={refreshing} className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap">
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
                                  if (t) highlightTransaction(t);
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
            </div>

            {showManualAdd && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) setShowManualAdd(false); }}>
                <div className="w-full max-w-md mx-4 bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-6">
                  <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500 mb-5">Adicionar transação manualmente</p>
                  <form onSubmit={(e) => { e.preventDefault(); confirmManualAdd(); }}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Data</label>
                        <input type="date" required value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Valor (R$)</label>
                        <input type="number" step="0.01" min="0.01" required value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors" />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Título</label>
                      <input type="text" required maxLength={255} value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors" />
                    </div>
                    <div className="mb-5">
                      <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">
                        Descrição <span className="normal-case tracking-normal opacity-60">(opcional)</span>
                      </label>
                      <input type="text" maxLength={500} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors" />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => setShowManualAdd(false)} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 transition-colors cursor-pointer">
                        Cancelar
                      </button>
                      <button type="submit" className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
                        Adicionar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterToolbarProps {
  showFilters: boolean;
  setShowFilters: (v: boolean | ((prev: boolean) => boolean)) => void;
  search: string;
  setSearch: (v: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  filterAmountMin: string;
  setFilterAmountMin: (v: string) => void;
  filterAmountMax: string;
  setFilterAmountMax: (v: string) => void;
  sortKey: "date" | "amount";
  sortDir: "asc" | "desc";
  setSort: (key: "date" | "amount") => void;
  onOpenManualAdd: () => void;
  currentTxnsCount: number;
}

function FilterToolbar(props: FilterToolbarProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        props.setShowFilters(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapperRef}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => props.setShowFilters((v) => !v)}
          className={`text-[10px] tracking-widest uppercase border px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            props.showFilters
              ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-200"
              : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-600 dark:hover:border-zinc-400"
          }`}
        >
          Filtros
        </button>
        <button
          type="button"
          onClick={props.onOpenManualAdd}
          className="text-[10px] tracking-widest uppercase border border-zinc-400 dark:border-zinc-600 px-3 py-1.5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
        >
          + Adicionar manualmente
        </button>
        <span className="hidden lg:flex flex-1" />
        <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">
          {props.currentTxnsCount} transações extraídas do PDF
        </span>
      </div>

      {props.showFilters && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 shrink-0">
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Descrição…"
            className="w-36 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <input
            type="date"
            title="Data inicial"
            value={props.filterDateFrom}
            onChange={(e) => props.setFilterDateFrom(e.target.value)}
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors scheme-light dark:scheme-dark"
          />
          <input
            type="date"
            title="Data final"
            value={props.filterDateTo}
            onChange={(e) => props.setFilterDateTo(e.target.value)}
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors scheme-light dark:scheme-dark"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="R$ min"
            value={props.filterAmountMin}
            onChange={(e) => props.setFilterAmountMin(e.target.value)}
            className="w-24 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="R$ max"
            value={props.filterAmountMax}
            onChange={(e) => props.setFilterAmountMax(e.target.value)}
            className="w-24 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <span className="text-zinc-300 dark:text-zinc-700 select-none">|</span>
          <button
            type="button"
            onClick={() => props.setSort("date")}
            className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap ${
              props.sortKey === "date" ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Data {props.sortKey === "date" ? (props.sortDir === "asc" ? "+" : "-") : ""}
          </button>
          <button
            type="button"
            onClick={() => props.setSort("amount")}
            className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap ${
              props.sortKey === "amount" ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Valor {props.sortKey === "amount" ? (props.sortDir === "asc" ? "+" : "-") : ""}
          </button>
          <span className="text-zinc-300 dark:text-zinc-700 select-none">|</span>
          <button
            type="button"
            onClick={() => {
              props.setSearch("");
              props.setFilterDateFrom("");
              props.setFilterDateTo("");
              props.setFilterAmountMin("");
              props.setFilterAmountMax("");
            }}
            className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
