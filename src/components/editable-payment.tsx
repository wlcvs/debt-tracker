"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { PaymentDetailModal } from "@/components/payment-detail-modal";

interface Props {
  payment: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    method: string;
  };
}

export function EditablePayment({ payment }: Props) {
  const [open, setOpen] = useState(false);

  const methodLabel = PAYMENT_METHODS[payment.method as PaymentMethodKey] ?? payment.method;

  return (
    <li className="border-b border-zinc-200 dark:border-zinc-900 last:border-0">
      <button
        onClick={() => setOpen(true)}
        className="w-full flex justify-between items-center py-3 hover:opacity-60 transition-opacity text-left gap-4 cursor-pointer"
      >
        <span className="text-xs tracking-widest text-zinc-700 dark:text-zinc-300">R$ {payment.amount.toFixed(2)}</span>
        <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 shrink-0">
          {methodLabel}
        </span>
      </button>

      {open && <PaymentDetailModal payment={payment} onClose={() => setOpen(false)} />}
    </li>
  );
}
