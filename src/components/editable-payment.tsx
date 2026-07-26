"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { PaymentDetailModal } from "@/components/payment-detail-modal";
import { formatCurrency } from "@/lib/format-utils";
import { Badge } from "@/components/badge";

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
        <span className="text-xs tracking-widest text-zinc-700 dark:text-zinc-300">R$ {formatCurrency(payment.amount)}</span>
        <Badge className="px-1.5 shrink-0">{methodLabel}</Badge>
      </button>

      {open && <PaymentDetailModal payment={payment} onClose={() => setOpen(false)} />}
    </li>
  );
}
