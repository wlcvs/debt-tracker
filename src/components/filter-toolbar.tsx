"use client";

import { useRef } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-utils";

interface FilterToolbarProps {
  showFilters: boolean;
  setShowFilters: (v: boolean | ((prev: boolean) => boolean)) => void;
  search: string;
  setSearch: (v: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  filterAmountMin: string;
  setFilterAmountMin: (v: string) => void;
  filterAmountMax: string;
  setFilterAmountMax: (v: string) => void;
  sortKey: "date" | "amount";
  sortDir: "asc" | "desc";
  setSort: (key: "date" | "amount") => void;
  onOpenManualAdd: () => void;
  currentTxnsCount: number;
}

export function FilterToolbar(props: FilterToolbarProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapperRef, () => props.setShowFilters(false), { escape: false });

  return (
    <Collapsible.Root open={props.showFilters} onOpenChange={props.setShowFilters} ref={wrapperRef}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className={`text-[10px] tracking-widest uppercase border px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              props.showFilters
                ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-600 dark:hover:border-zinc-400"
            }`}
          >
            Filtros
          </button>
        </Collapsible.Trigger>
        <button
          type="button"
          onClick={props.onOpenManualAdd}
          className="text-[10px] tracking-widest uppercase border border-zinc-400 dark:border-zinc-600 px-3 py-1.5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
        >
          + Adicionar manualmente
        </button>
        <span className="hidden lg:flex flex-1" />
        <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">
          {props.currentTxnsCount} transações extraídas do PDF
        </span>
      </div>

      <Collapsible.Content>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 shrink-0">
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Descrição…"
            className="w-36 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <input
            type="date"
            title="Data inicial"
            value={props.filterDateFrom}
            onChange={(e) => props.setFilterDateFrom(e.target.value)}
            min={DATE_INPUT_MIN}
            max={DATE_INPUT_MAX}
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors scheme-light dark:scheme-dark"
          />
          <input
            type="date"
            title="Data final"
            value={props.filterDateTo}
            onChange={(e) => props.setFilterDateTo(e.target.value)}
            min={DATE_INPUT_MIN}
            max={DATE_INPUT_MAX}
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors scheme-light dark:scheme-dark"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="R$ min"
            value={props.filterAmountMin}
            onChange={(e) => props.setFilterAmountMin(e.target.value)}
            className="w-24 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="R$ max"
            value={props.filterAmountMax}
            onChange={(e) => props.setFilterAmountMax(e.target.value)}
            className="w-24 bg-transparent border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <span className="text-zinc-300 dark:text-zinc-700 select-none">|</span>
          <button
            type="button"
            onClick={() => props.setSort("date")}
            className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap ${
              props.sortKey === "date" ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Data {props.sortKey === "date" ? (props.sortDir === "asc" ? "+" : "-") : ""}
          </button>
          <button
            type="button"
            onClick={() => props.setSort("amount")}
            className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap ${
              props.sortKey === "amount" ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Valor {props.sortKey === "amount" ? (props.sortDir === "asc" ? "+" : "-") : ""}
          </button>
          <span className="text-zinc-300 dark:text-zinc-700 select-none">|</span>
          <button
            type="button"
            onClick={() => {
              props.setSearch("");
              props.setFilterDateFrom("");
              props.setFilterDateTo("");
              props.setFilterAmountMin("");
              props.setFilterAmountMax("");
            }}
            className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Limpar
          </button>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
