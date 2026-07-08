"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditableDebt } from "@/components/editable-debt";
import { CreateDebtForm } from "@/components/create-debt-form";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";

interface Debt {
  id: string;
  amount: number;
  title: string;
  description: string;
  paid: boolean;
  date: Date;
  method: string | null;
  creditCardId: string | null;
  creditCardLabel: string | null;
}

interface Props {
  personId: string;
  debts: Debt[];
  creditCards: { id: string; label: string }[];
}

function parseAmountFilter(s: string): { val: number; isInt: boolean } {
  const n = s.replace(",", ".");
  return { val: parseFloat(n), isInt: !n.includes(".") };
}

export function DebtsSection({ personId, debts, creditCards }: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function setSort(key: "date" | "amount") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setSortKey("date");
    setSortDir("desc");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = amountMin ? parseAmountFilter(amountMin) : null;
    const amtMax = amountMax ? parseAmountFilter(amountMax) : null;

    const list = debts.filter((d) => {
      if (q) {
        const methodStr = d.creditCardLabel ?? (d.method ? PAYMENT_METHODS[d.method as PaymentMethodKey] ?? d.method : "");
        const amtStr = d.amount.toFixed(2).replace(".", ",");
        const hit = [d.title, d.description, methodStr, amtStr].some((s) => s.toLowerCase().includes(q));
        if (!hit) return false;
      }
      const dateStr = d.date.toISOString().slice(0, 10);
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;
      if (amtMin && !isNaN(amtMin.val)) {
        const v = amtMin.isInt ? Math.floor(d.amount) : d.amount;
        if (v < amtMin.val) return false;
      }
      if (amtMax && !isNaN(amtMax.val)) {
        const v = amtMax.isInt ? Math.floor(d.amount) : d.amount;
        if (v > amtMax.val) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const av = sortKey === "amount" ? a.amount : a.date.getTime();
      const bv = sortKey === "amount" ? b.amount : b.date.getTime();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [debts, search, dateFrom, dateTo, amountMin, amountMax, sortKey, sortDir]);

  const filtersActive = Boolean(showFilters || search || dateFrom || dateTo || amountMin || amountMax);

  return (
    <section className="flex flex-col gap-4 border border-zinc-300 dark:border-zinc-700 p-4">
      <div ref={wrapperRef}>
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Dívidas</p>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`text-[10px] tracking-widest uppercase hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
              filtersActive ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
            }`}
          >
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-2 mt-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar dívidas..."
              className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">De</p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Até</p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor mín.</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor máx.</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[10px] tracking-widest uppercase text-zinc-400">Ordenar</p>
              <button
                type="button"
                onClick={() => setSort("date")}
                className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                  sortKey === "date" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
                }`}
              >
                Data {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                type="button"
                onClick={() => setSort("amount")}
                className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                  sortKey === "amount" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
                }`}
              >
                Valor {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors ml-auto cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <ul className="flex flex-col">
          {filtered.map((debt) => (
            <EditableDebt key={debt.id} debt={debt} creditCards={creditCards} />
          ))}
        </ul>
      )}

      <CreateDebtForm personId={personId} creditCards={creditCards} />
    </section>
  );
}
