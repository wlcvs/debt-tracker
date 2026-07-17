"use client";

import { useState } from "react";
import { deleteDebt, deleteDebtInstallmentGroup, toggleDebtPaid, updateDebt } from "@/lib/actions/debt";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InstallmentGroupPanel } from "@/components/installment-group-panel";
import { formatDateBR } from "@/lib/date-utils";

interface DebtLike {
  id: string;
  title: string;
  description: string;
  amount: number;
  date: Date;
  paid: boolean;
  method: string | null;
  creditCardId: string | null;
  creditCardLabel: string | null;
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
}

interface Props {
  debt: DebtLike;
  creditCards: { id: string; label: string }[];
  onClose: () => void;
}

const METHOD_LABELS: Record<string, string> = { PIX: "Pix", CASH: "Dinheiro" };

export function DebtDetailModal({ debt, creditCards, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showInstallments, setShowInstallments] = useState(false);
  const [method, setMethod] = useState(debt.creditCardId ?? debt.method ?? "");
  const [methodError, setMethodError] = useState(false);
  const isInstallment = Boolean(debt.installmentGroupId);

  const methodOptions: MethodOption[] = [
    { value: "PIX", label: "Pix" },
    { value: "CASH", label: "Dinheiro" },
    ...creditCards.map((c) => ({ value: c.id, label: c.label })),
  ];

  const badgeLabel = debt.creditCardLabel ?? (debt.method ? METHOD_LABELS[debt.method] ?? debt.method : null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Dívida</p>
          <button onClick={onClose} className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            Fechar
          </button>
        </div>

        {!editing ? (
          <div className="px-6 py-5">
            <p className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white mb-1">{debt.title}</p>
            <p className="text-3xl tracking-tight text-zinc-900 dark:text-white mb-3">R$ {debt.amount.toFixed(2)}</p>
            {debt.description && (
              <p className="text-xs tracking-wider text-zinc-500 dark:text-zinc-400 -mt-2 mb-2">{debt.description}</p>
            )}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(debt.date)}</span>
              {badgeLabel && (
                <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
                  {badgeLabel}
                </span>
              )}
              {isInstallment && (
                <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
                  Parcela {debt.installmentIndex}/{debt.installmentTotal}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {!isInstallment && (
                <button
                  onClick={() => setEditing(true)}
                  className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Editar
                </button>
              )}
              <button
                onClick={async () => {
                  const fd = new FormData();
                  fd.append("id", debt.id);
                  await toggleDebtPaid(fd);
                  onClose();
                }}
                className={`border px-5 py-2 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
                  debt.paid
                    ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white"
                    : "border-zinc-500 dark:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:border-zinc-700 hover:text-zinc-800 dark:hover:border-zinc-300 dark:hover:text-zinc-200"
                }`}
              >
                {debt.paid ? "Desfazer" : "Marcar como paga"}
              </button>
              {isInstallment && (
                <button
                  onClick={() => setShowInstallments(true)}
                  className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Ver parcelas
                </button>
              )}
              <button
                onClick={() => setConfirming(true)}
                className="border border-red-500 dark:border-red-400 px-5 py-2 text-xs tracking-widest uppercase text-red-500 dark:text-red-400 hover:border-red-400 hover:text-red-400 dark:hover:border-red-300 dark:hover:text-red-300 transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!method) {
                setMethodError(true);
                return;
              }
              setMethodError(false);
              const fd = new FormData(e.currentTarget);
              await updateDebt(fd);
              onClose();
            }}
            className="px-6 py-5 flex flex-col gap-3"
          >
            <input type="hidden" name="id" value={debt.id} />
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Título</p>
              <input
                type="text"
                name="title"
                defaultValue={debt.title}
                required
                placeholder="Ex: Supermercado"
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              />
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">
                Descrição <span className="normal-case text-zinc-300 dark:text-zinc-700">(opcional)</span>
              </p>
              <input
                type="text"
                name="description"
                defaultValue={debt.description}
                placeholder="Ex: Parcelado 3x"
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              />
            </div>
            <div className="flex gap-3">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor</p>
                <input
                  type="text"
                  inputMode="decimal"
                  name="amount"
                  defaultValue={debt.amount.toFixed(2)}
                  required
                  className="w-28 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Data</p>
                <input
                  type="date"
                  name="date"
                  defaultValue={debt.date.toISOString().slice(0, 10)}
                  required
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Método</p>
              <MethodSelect
                name="debtMethod"
                options={methodOptions}
                value={method}
                onChange={(v) => {
                  setMethod(v);
                  setMethodError(false);
                }}
                error={methodError}
              />
            </div>
            <div className="flex justify-between items-center pt-1">
              <div className="flex gap-3">
                <button
                  type="submit"
                  onClick={() => setMethodError(!method)}
                  className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs tracking-widest uppercase text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </form>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Excluir dívida?"
          description={
            isInstallment
              ? `Todas as ${debt.installmentTotal} parcelas de "${debt.title}" serão removidas permanentemente.`
              : `"${debt.title}" será removida permanentemente.`
          }
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            const fd = new FormData();
            if (isInstallment && debt.installmentGroupId) {
              fd.append("installmentGroupId", debt.installmentGroupId);
              await deleteDebtInstallmentGroup(fd);
            } else {
              fd.append("id", debt.id);
              await deleteDebt(fd);
            }
            onClose();
          }}
        />
      )}

      {showInstallments && debt.installmentGroupId && (
        <InstallmentGroupPanel
          installmentGroupId={debt.installmentGroupId}
          title={debt.title.replace(/\s*\(\d+\/\d+\)$/, "")}
          onClose={() => setShowInstallments(false)}
        />
      )}
    </div>
  );
}
