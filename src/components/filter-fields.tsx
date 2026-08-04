"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { PaidFilter, SortDir, SortKey } from "@/lib/hooks/use-list-filter-sort";
import { DateField } from "@/components/date-field";

interface FilterFieldsProps {
  search: string;
  setSearch: (v: string) => void;
  dateFrom?: string;
  setDateFrom?: (v: string) => void;
  dateTo?: string;
  setDateTo?: (v: string) => void;
  amountMin: string;
  setAmountMin: (v: string) => void;
  amountMax: string;
  setAmountMax: (v: string) => void;
  paidFilter?: PaidFilter;
  setPaidFilter?: (v: PaidFilter) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  setSort: (key: SortKey) => void;
  onClear: () => void;
  searchPlaceholder: string;
}

export function FilterFields(props: FilterFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        placeholder={props.searchPlaceholder}
        className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
      />
      {props.setDateFrom && props.setDateTo && (
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">De</p>
            <DateField
              aria-label="De"
              value={props.dateFrom}
              onChange={(v) => props.setDateFrom?.(v)}
              className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus-within:border-zinc-500 dark:focus-within:border-zinc-400 transition-colors"
            />
          </div>
          <div className="flex-1">
            <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Até</p>
            <DateField
              aria-label="Até"
              value={props.dateTo}
              onChange={(v) => props.setDateTo?.(v)}
              className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus-within:border-zinc-500 dark:focus-within:border-zinc-400 transition-colors"
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor mín.</p>
          <input
            type="text"
            inputMode="decimal"
            value={props.amountMin}
            onChange={(e) => props.setAmountMin(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Valor máx.</p>
          <input
            type="text"
            inputMode="decimal"
            value={props.amountMax}
            onChange={(e) => props.setAmountMax(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
        </div>
      </div>
      {props.paidFilter && props.setPaidFilter && (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[10px] tracking-widest uppercase text-zinc-400">Status</p>
          <ToggleGroup.Root
            type="single"
            value={props.paidFilter}
            onValueChange={(v) => { if (v) props.setPaidFilter?.(v as PaidFilter); }}
            aria-label="Status"
            className="flex items-center gap-3"
          >
            {(["all", "paid", "unpaid"] as const).map((key) => (
              <ToggleGroup.Item
                key={key}
                value={key}
                className="text-[10px] tracking-widest uppercase transition-colors cursor-pointer text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 data-[state=on]:text-zinc-700 dark:data-[state=on]:text-zinc-300"
              >
                {key === "all" ? "Todas" : key === "paid" ? "Pagas" : "Não pagas"}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[10px] tracking-widest uppercase text-zinc-400">Ordenar</p>
        <button
          type="button"
          onClick={() => props.setSort("date")}
          className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
            props.sortKey === "date" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
          }`}
        >
          Data {props.sortKey === "date" ? (props.sortDir === "asc" ? "+" : "-") : ""}
        </button>
        <button
          type="button"
          onClick={() => props.setSort("amount")}
          className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
            props.sortKey === "amount" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
          }`}
        >
          Valor {props.sortKey === "amount" ? (props.sortDir === "asc" ? "+" : "-") : ""}
        </button>
        <button
          type="button"
          onClick={props.onClear}
          className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors ml-auto cursor-pointer"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
