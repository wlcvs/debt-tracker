"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { saveLLMFeedback } from "@/lib/actions/statement";
import type { Txn } from "@/lib/import-modal-types";
import { DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-utils";
import { MethodSelect, type MethodOption } from "@/components/method-select";

interface Props {
  bank: string;
  creditCards: { id: string; label: string }[];
  /** The import modal's review-step container. Portalling here instead of to
   * document.body keeps this dialog covering only the review pane, the way its
   * `absolute inset-0` always did — a body portal would make it full-viewport
   * and spill over the import modal's own lg:p-6 gutter. It is still a nested
   * dismissable layer either way: Radix tracks layers through React context,
   * not the DOM, so Escape reaches this dialog and stops here. */
  container: HTMLElement | null;
  onClose: () => void;
  onAdd: (txn: Txn) => void;
}

export function ManualAddDialog({ bank, creditCards, container, onClose, onAdd }: Props) {
  const [manualDate, setManualDate] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("");
  const [manualMethodError, setManualMethodError] = useState(false);

  const methodOptions: MethodOption[] = useMemo(
    () => [
      { value: "PIX", label: "Pix" },
      { value: "CASH", label: "Dinheiro" },
      ...creditCards.map((c) => ({ value: c.id, label: c.label })),
    ],
    [creditCards]
  );

  async function confirmManualAdd() {
    if (!manualDate || !manualTitle || !manualAmount) return;
    if (!manualMethod) {
      setManualMethodError(true);
      return;
    }

    const newTxn: Txn = {
      index: `manual_${Date.now()}`,
      date: manualDate,
      description: manualTitle,
      title: manualTitle,
      notes: manualNotes,
      amount: parseFloat(manualAmount).toFixed(2),
      personAccessCode: "",
      type: "debt",
      method: manualMethod,
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
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <Dialog.Content className="w-full max-w-md mx-4 bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-6">
            <Dialog.Title className="block text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500 mb-5">Adicionar transação manualmente</Dialog.Title>
            <form onSubmit={(e) => { e.preventDefault(); confirmManualAdd(); }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Data</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                    className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
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
              <div className="mb-5">
                <label className="block text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Método</label>
                <MethodSelect
                  name="manualMethod"
                  options={methodOptions}
                  value={manualMethod}
                  onChange={(v) => {
                    setManualMethod(v);
                    setManualMethodError(false);
                  }}
                  error={manualMethodError}
                />
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
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
