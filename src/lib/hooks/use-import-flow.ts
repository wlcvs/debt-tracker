"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  importStatement,
  reopenStatement,
  saveImportedTransactions,
} from "@/lib/actions/statement";
import type { Txn } from "@/lib/import-modal-types";

interface ImportResultLike {
  bank: string;
  algorithm: Record<string, unknown>[];
  LLM: Record<string, unknown>[];
  statementId: string;
  cached?: boolean;
}

interface Options {
  reopenStatementId: string | null;
  cameFromStatements: boolean;
  onClose: () => void;
  onBackToStatements: () => void;
}

/**
 * Owns the upload/process/save lifecycle: which step is showing, the two
 * transaction lists (algorithmic vs LLM), the active statement, and the
 * blob URL for a freshly-picked (not yet saved) PDF file.
 *
 * Does NOT own PDF-viewer/highlight state (see usePdfHighlights) — the two
 * are siblings, not nested, so the caller (ImportModal) is what combines
 * both hooks' reset() on close, avoiding a circular dependency (this hook's
 * output feeds usePdfHighlights' input).
 */
export function useImportFlow({ reopenStatementId, cameFromStatements, onClose, onBackToStatements }: Options) {
  const router = useRouter();

  const [step, setStep] = useState<"upload" | "processing" | "review" | "saving">("upload");
  const [bank, setBank] = useState("");
  const [algoTxns, setAlgoTxns] = useState<Txn[]>([]);
  const [LLMTxns, setLLMTxns] = useState<Txn[]>([]);
  const [error, setError] = useState("");
  const [statementId, setStatementId] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const pdfBlobUrlRef = useRef("");
  useEffect(() => {
    pdfBlobUrlRef.current = pdfBlobUrl;
  }, [pdfBlobUrl]);

  const currentTxns = LLMTxns.length ? LLMTxns : algoTxns;
  const pdfSrc = pdfBlobUrl || (statementId ? `/api/statements/${statementId}/pdf` : "");

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

  function addManualTxn(txn: Txn) {
    setLLMTxns((prev) => [...prev, txn]);
  }

  function reset() {
    if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
    setPdfBlobUrl("");
    setStatementId(null);
    setStep("upload");
    setBank("");
    setAlgoTxns([]);
    setLLMTxns([]);
    setError("");
  }

  function handleClose() {
    const backToStatements = cameFromStatements;
    reset();
    onClose();
    if (backToStatements) onBackToStatements();
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
        method: t.method,
      }));

    try {
      await saveImportedTransactions(items);
      router.refresh();
      handleClose();
    } catch {
      setStep("review");
    }
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
      if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
    };
  }, []);

  return {
    step,
    bank,
    algoTxns,
    LLMTxns,
    currentTxns,
    error,
    statementId,
    pdfSrc,
    refreshing,
    patchCurrentTxn,
    addManualTxn,
    reset,
    handleClose,
    processFile,
    handleDrop,
    handleFile,
    runFreshLLM,
    save,
  };
}
