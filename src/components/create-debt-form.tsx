"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createDebt } from "@/lib/actions/debt";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { Checkbox } from "@/components/checkbox";
import { splitInstallmentAmounts, installmentDate, type InstallmentDirection } from "@/lib/installments";
import { formatDateBR } from "@/lib/date-utils";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

interface Props {
  personId: string;
  creditCards: { id: string; label: string }[];
}

export function CreateDebtForm({ personId, creditCards }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("");
  const [methodError, setMethodError] = useState(false);
  const [paid, setPaid] = useState(false);
  const [installment, setInstallment] = useState(false);
  const [installments, setInstallments] = useState(2);
  const [direction, setDirection] = useState<InstallmentDirection>("forward");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidIndexes, setPaidIndexes] = useState<Set<number>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) reset();
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const methodOptions: MethodOption[] = [
    { value: "PIX", label: "Pix" },
    { value: "CASH", label: "Dinheiro" },
    ...creditCards.map((c) => ({ value: c.id, label: c.label })),
  ];

  const preview = useMemo(() => {
    if (!installment) return [];
    const total = Number(amount.replace(",", "."));
    const baseDate = date ? new Date(`${date}T00:00:00Z`) : null;
    if (!baseDate || Number.isNaN(total) || total <= 0) return [];
    const amounts = splitInstallmentAmounts(total, installments);
    return amounts.map((value, i) => ({
      index: i + 1,
      amount: value,
      date: installmentDate(baseDate, i + 1, installments, direction),
    }));
  }, [installment, amount, date, installments, direction]);

  function reset() {
    setMethod("");
    setMethodError(false);
    setPaid(false);
    setInstallment(false);
    setInstallments(2);
    setDirection("forward");
    setAmount("");
    setDate("");
    setPaidIndexes(new Set());
    setOpen(false);
  }

  function togglePaidIndex(index: number) {
    setPaidIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        + Adicionar dívida
      </button>

      {open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!method) {
              setMethodError(true);
              return;
            }
            setMethodError(false);
            const fd = new FormData(e.currentTarget);
            if (installment) {
              fd.set("installments", String(installments));
              fd.set("installmentDirection", direction);
              fd.set("paidInstallments", JSON.stringify(Array.from(paidIndexes)));
            } else if (paid) {
              fd.set("paid", "on");
            }
            await createDebt(fd);
            reset();
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="personId" value={personId} />

          <input type="text" name="title" placeholder="TÍTULO" required className={inputClass} />
          <input type="text" name="description" placeholder="DESCRIÇÃO (opcional)" className={inputClass} />

          <div className="flex gap-2 items-start">
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              placeholder={installment ? "VALOR TOTAL" : "VALOR"}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-28 ${inputClass}`}
            />
            <div className="flex-1">
              <input
                type="date"
                name="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full ${inputClass} text-zinc-500 dark:text-zinc-400`}
              />
            </div>
          </div>

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

          <Checkbox
            checked={installment}
            onChange={(checked) => {
              setInstallment(checked);
              if (checked) setPaid(false);
            }}
            label="Parcelar"
          />

          {installment ? (
            <div className="flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="flex gap-2 items-center">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Número de parcelas</p>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={installments}
                    onChange={(e) => setInstallments(Math.min(60, Math.max(2, Number(e.target.value) || 2)))}
                    className={`w-20 ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Parcelas para</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("forward")}
                    className={`border px-3 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
                      direction === "forward"
                        ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    Meses futuros
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("backward")}
                    className={`border px-3 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
                      direction === "backward"
                        ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    Meses passados
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                  {direction === "forward"
                    ? "A data informada é a da 1ª parcela."
                    : "A data informada é a da última parcela (mais recente)."}
                </p>
              </div>

              {preview.length > 0 && (
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Parcelas (marque as já pagas)</p>
                  <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {preview.map((p) => (
                      <li key={p.index} className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <Checkbox
                          checked={paidIndexes.has(p.index)}
                          onChange={() => togglePaidIndex(p.index)}
                          label={`${p.index}/${installments} — ${formatDateBR(p.date)}`}
                        />
                        <span>R$ {p.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Checkbox checked={paid} onChange={setPaid} label="Já paga" />
          )}

          <div className="flex gap-3 items-center">
            <button
              type="submit"
              onClick={() => setMethodError(!method)}
              className="border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Salvar
            </button>
            <button type="button" onClick={reset} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
