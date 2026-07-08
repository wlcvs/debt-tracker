"use client";

import { useState } from "react";
import { deletePayment, updatePayment } from "@/lib/actions/payment";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface PaymentLike {
  id: string;
  amount: number;
  description: string;
  date: Date;
  method: string;
}

interface Props {
  payment: PaymentLike;
  onClose: () => void;
}

const METHOD_OPTIONS: MethodOption[] = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));

export function PaymentDetailModal({ payment, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState(payment.method);

  const methodLabel = PAYMENT_METHODS[payment.method as PaymentMethodKey] ?? payment.method;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Pagamento</p>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            ✕
          </button>
        </div>

        {!editing ? (
          <div className="px-6 py-5">
            <p className="text-3xl tracking-tight text-zinc-900 dark:text-white mb-1">R$ {payment.amount.toFixed(2)}</p>
            {payment.description ? (
              <p className="text-sm tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">{payment.description}</p>
            ) : (
              <div className="mb-3" />
            )}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs text-zinc-400 dark:text-zinc-600">{payment.date.toLocaleDateString("pt-BR")}</span>
              <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
                {methodLabel}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(true)}
                className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Editar
              </button>
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
              const fd = new FormData(e.currentTarget);
              await updatePayment(fd);
              onClose();
            }}
            className="px-6 py-5 flex flex-col gap-3"
          >
            <input type="hidden" name="id" value={payment.id} />
            <div className="flex gap-3">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor</p>
                <input
                  type="text"
                  inputMode="decimal"
                  name="amount"
                  defaultValue={payment.amount.toFixed(2)}
                  required
                  className="w-28 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Data</p>
                <input
                  type="date"
                  name="date"
                  defaultValue={payment.date.toISOString().slice(0, 10)}
                  required
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">
                Descrição <span className="normal-case text-zinc-300 dark:text-zinc-700">(opcional)</span>
              </p>
              <input
                type="text"
                name="description"
                defaultValue={payment.description}
                placeholder="Ex: Parcela 1"
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              />
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Método</p>
              <MethodSelect name="method" options={METHOD_OPTIONS} value={method} onChange={setMethod} />
            </div>
            <div className="flex justify-between items-center pt-1">
              <div className="flex gap-3">
                <button
                  type="submit"
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
          title="Excluir pagamento?"
          description={`Pagamento de R$ ${payment.amount.toFixed(2)} será removido permanentemente.`}
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.append("id", payment.id);
            await deletePayment(fd);
            onClose();
          }}
        />
      )}
    </div>
  );
}
