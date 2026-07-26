"use client";

import { useState } from "react";
import { DebtDetailModal } from "@/components/debt-detail-modal";
import { formatCurrency } from "@/lib/format-utils";
import { Badge } from "@/components/badge";

interface Props {
  debt: {
    id: string;
    amount: number;
    title: string;
    description: string;
    paid: boolean;
    date: Date;
    method: string | null;
    creditCardId: string | null;
    creditCardLabel: string | null;
    installmentGroupId: string | null;
    installmentIndex: number | null;
    installmentTotal: number | null;
  };
  creditCards: { id: string; label: string }[];
}

export function EditableDebt({ debt, creditCards }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-zinc-100 dark:border-zinc-900 last:border-0">
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex justify-between items-center py-3 hover:opacity-60 transition-opacity text-left gap-4 cursor-pointer${debt.paid ? " opacity-50" : ""}`}
      >
        <span className={`flex items-center gap-2 text-xs tracking-widest text-zinc-700 dark:text-zinc-300 truncate${debt.paid ? " line-through" : ""}`}>
          {debt.title || <span className="text-zinc-400 dark:text-zinc-600 italic">sem título</span>}
          {debt.installmentGroupId && (
            <Badge className="px-1 shrink-0 no-underline">
              {debt.installmentIndex}/{debt.installmentTotal}
            </Badge>
          )}
        </span>
        <span className={`text-xs text-zinc-700 dark:text-zinc-300 shrink-0${debt.paid ? " line-through" : ""}`}>
          R$ {formatCurrency(debt.amount)}
        </span>
      </button>

      {open && <DebtDetailModal debt={debt} creditCards={creditCards} onClose={() => setOpen(false)} />}
    </li>
  );
}
