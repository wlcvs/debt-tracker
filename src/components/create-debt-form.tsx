"use client";

import { useState } from "react";
import { createDebt } from "@/lib/actions/debt";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors";

const selectClass =
  "appearance-none w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 pl-3 pr-12 py-2 text-xs tracking-wider text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors";

interface Props {
  personId: string;
  creditCards: { id: string; label: string }[];
}

export function CreateDebtForm({ personId, creditCards }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(fd: FormData): boolean {
    const next: Record<string, string> = {};
    if (!fd.get("amount")) next.amount = "Informe o valor.";
    if (!fd.get("description")?.toString().trim()) next.description = "Informe a descrição.";
    if (!fd.get("date")) next.date = "Selecione uma data.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!validate(fd)) return;
        await createDebt(fd);
        e.currentTarget.reset();
        setErrors({});
      }}
      className="flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800 p-4"
    >
      <p className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 mb-1">
        Nova dívida
      </p>
      <input type="hidden" name="personId" value={personId} />

      <div className="flex flex-col gap-1">
        <input
          type="number"
          name="amount"
          step="0.01"
          placeholder="VALOR"
          className={inputClass}
          onChange={(e) => e.target.value && setErrors((p) => ({ ...p, amount: "" }))}
        />
        {errors.amount && <p className="text-[10px] tracking-wide text-red-500">{errors.amount}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <input
          type="text"
          name="description"
          placeholder="DESCRIÇÃO"
          className={inputClass}
          onChange={(e) => e.target.value.trim() && setErrors((p) => ({ ...p, description: "" }))}
        />
        {errors.description && <p className="text-[10px] tracking-wide text-red-500">{errors.description}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <input
          type="date"
          name="date"
          className={inputClass + " text-zinc-500 dark:text-zinc-400"}
          onChange={(e) => e.target.value && setErrors((p) => ({ ...p, date: "" }))}
        />
        {errors.date && <p className="text-[10px] tracking-wide text-red-500">{errors.date}</p>}
      </div>

      <div className="relative">
        <select name="debtMethod" className={selectClass}>
          <option value="PIX">PIX</option>
          <option value="CASH">DINHEIRO</option>
          {creditCards.map((card) => (
            <option key={card.id} value={card.id}>
              CARTÃO {card.label.toUpperCase()}
            </option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <button
        type="submit"
        className="border border-zinc-300 dark:border-zinc-800 py-2 text-xs tracking-widest uppercase text-zinc-500 hover:border-zinc-900 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors cursor-pointer"
      >
        + Adicionar
      </button>
    </form>
  );
}
