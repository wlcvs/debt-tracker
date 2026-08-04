"use client";

import { formatCurrency } from "@/lib/format-utils";
import { toDateInputValue } from "@/lib/date-utils";
import { DateField } from "@/components/date-field";

interface Props {
  amount: number;
  date: Date;
}

/** Shared Valor/Data field pair for debt-detail-modal.tsx and payment-detail-modal.tsx's edit forms. */
export function AmountDateFields({ amount, date }: Props) {
  return (
    <div className="flex gap-3">
      <div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor</p>
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          defaultValue={formatCurrency(amount)}
          required
          autoComplete="off"
          className="w-28 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
        />
      </div>
      <div className="flex-1">
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Data</p>
        <DateField
          name="date"
          defaultValue={toDateInputValue(date)}
          required
          className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus-within:border-zinc-500 dark:focus-within:border-zinc-400"
        />
      </div>
    </div>
  );
}
