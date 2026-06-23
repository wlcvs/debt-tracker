"use client";

import { useState } from "react";
import { deleteDebt, updateDebt } from "@/lib/actions/debt";

interface Props {
  debt: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    isCovered: boolean;
  };
}

export function EditableDebt({ debt }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="flex flex-col gap-1 py-2 border-b border-zinc-200 dark:border-zinc-900">
        <form
          action={async (fd) => { await updateDebt(fd); setEditing(false); }}
          className="flex flex-col gap-1"
        >
          <input type="hidden" name="id" value={debt.id} />
          <input
            type="text"
            name="description"
            defaultValue={debt.description}
            required
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
          />
          <div className="flex gap-2">
            <input
              type="number"
              name="amount"
              defaultValue={debt.amount}
              step="0.01"
              required
              className="w-24 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
            />
            <input
              type="date"
              name="date"
              defaultValue={debt.date.toISOString().slice(0, 10)}
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
              Salvar
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`flex justify-between items-center text-xs py-2 border-b border-zinc-100 dark:border-zinc-900 gap-2 ${debt.isCovered ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
      <span className="truncate flex-1">{debt.description}</span>
      <span className="shrink-0 tracking-tight">R$ {debt.amount.toFixed(2)}</span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setEditing(true)} className="text-zinc-400 dark:text-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-pointer" title="Editar">✎</button>
        <form action={deleteDebt}>
          <input type="hidden" name="id" value={debt.id} />
          <button type="submit" className="text-zinc-400 dark:text-zinc-700 hover:text-red-500 transition-colors cursor-pointer" title="Remover">✕</button>
        </form>
      </div>
    </li>
  );
}
