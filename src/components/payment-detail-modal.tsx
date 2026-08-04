"use client";

import { useState } from "react";
import { deletePayment, updatePayment } from "@/lib/actions/payment";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { formatDateBR } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/format-utils";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ModalShell } from "@/components/modal-shell";
import { AmountDateFields } from "@/components/amount-date-fields";
import { Badge } from "@/components/badge";
import { useConfirmDelete } from "@/lib/hooks/use-confirm-delete";

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
  const [method, setMethod] = useState(payment.method);
  const [submitError, setSubmitError] = useState("");
  const { confirming, setConfirming, confirmDelete } = useConfirmDelete<PaymentLike>((p) => {
    const fd = new FormData();
    fd.append("id", p.id);
    return deletePayment(fd);
  }, onClose);

  const methodLabel = PAYMENT_METHODS[payment.method as PaymentMethodKey] ?? payment.method;

  return (
    <ModalShell eyebrow="Pagamento" onClose={onClose}>
      {!editing ? (
        <div className="px-6 py-5">
          <p className="text-3xl tracking-tight text-zinc-900 dark:text-white mb-1">R$ {formatCurrency(payment.amount)}</p>
          {payment.description ? (
            <p className="text-sm tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">{payment.description}</p>
          ) : (
            <div className="mb-3" />
          )}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(payment.date)}</span>
            <Badge>{methodLabel}</Badge>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(true)}
              className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Editar
            </button>
            <button
              onClick={() => setConfirming(payment)}
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
            setSubmitError("");
            const fd = new FormData(e.currentTarget);
            // A rejected Server Action would otherwise fail silently, leaving
            // the modal open with no clue why nothing saved.
            try {
              await updatePayment(fd);
            } catch {
              setSubmitError("Não foi possível salvar. Confira os campos e tente de novo.");
              return;
            }
            onClose();
          }}
          className="px-6 py-5 flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={payment.id} />
          <AmountDateFields amount={payment.amount} date={payment.date} />
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
          {submitError && <p className="text-xs text-red-500 tracking-wide">{submitError}</p>}
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
              onClick={() => setConfirming(payment)}
              className="text-xs tracking-widest uppercase text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors cursor-pointer"
            >
              Excluir
            </button>
          </div>
        </form>
      )}

      {confirming && (
        <ConfirmDialog
          title="Excluir pagamento?"
          description={`Pagamento de R$ ${formatCurrency(payment.amount)} será removido permanentemente.`}
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(null)}
          onConfirm={confirmDelete}
        />
      )}
    </ModalShell>
  );
}
