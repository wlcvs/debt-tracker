"use client";

import { useState } from "react";
import { saveLLMFeedback } from "@/lib/actions/statement";
import type { Txn } from "@/lib/import-modal-types";

interface Props {
  bank: string;
  onClose: () => void;
  onAdd: (txn: Txn) => void;
}

export function ManualAddDialog({ bank, onClose, onAdd }: Props) {
  const [manualDate, setManualDate] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualAmount, setManualAmount] = useState("");

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

    onAdd(newTxn);
    onClose();

    try {
      await saveLLMFeedback(bank, [{ date: manualDate, description: manualTitle, amount: manualAmount, context: "" }]);
    } catch (e) {
      console.error("Failed to save correction:", e);
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
            <button type="button" onClick={onClose} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
