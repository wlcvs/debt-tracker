"use client";

import { useState } from "react";
import { DebtDetailModal } from "@/components/debt-detail-modal";

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
            <span className="shrink-0 text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1 py-0.5 no-underline">
              {debt.installmentIndex}/{debt.installmentTotal}
            </span>
          )}
        </span>
        <span className={`text-xs text-zinc-700 dark:text-zinc-300 shrink-0${debt.paid ? " line-through" : ""}`}>
          R$ {debt.amount.toFixed(2)}
        </span>
      </button>

      {open && <DebtDetailModal debt={debt} creditCards={creditCards} onClose={() => setOpen(false)} />}
    </li>
  );
}
