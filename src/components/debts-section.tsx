"use client";

import { useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EditableDebt } from "@/components/editable-debt";
import { CreateDebtForm } from "@/components/create-debt-form";
import { FilterFields } from "@/components/filter-fields";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { formatCurrency } from "@/lib/format-utils";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useFilteredSortedList } from "@/lib/hooks/use-list-filter-sort";

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
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
}

interface Props {
  personId: string;
  debts: Debt[];
  creditCards: { id: string; label: string }[];
  selectedMonth?: string;
}

export function DebtsSection({ personId, debts, creditCards, selectedMonth }: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapperRef, () => setShowFilters(false));

  const {
    filtered,
    filtersActive: filterValuesActive,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    paidFilter,
    setPaidFilter,
    sortKey,
    sortDir,
    setSort,
    clearFilters,
  } = useFilteredSortedList({
    items: debts,
    selectedMonth,
    hasDateRange: true,
    getDate: (d) => d.date,
    getAmount: (d) => d.amount,
    getPaid: (d) => d.paid,
    getSearchText: (d) => [
      d.title,
      d.description,
      d.creditCardLabel ?? (d.method ? PAYMENT_METHODS[d.method as PaymentMethodKey] ?? d.method : ""),
      formatCurrency(d.amount).replace(".", ","),
    ],
  });

  const filtersActive = Boolean(showFilters || filterValuesActive);

  return (
    <section className="flex flex-col gap-4 border border-zinc-300 dark:border-zinc-700 p-4">
      <Collapsible.Root open={showFilters} onOpenChange={setShowFilters} ref={wrapperRef}>
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Dívidas</p>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className={`text-[10px] tracking-widest uppercase hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
                filtersActive ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              Filtros
            </button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content>
          <div className="mt-3">
            <FilterFields
              search={search}
              setSearch={setSearch}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              amountMin={amountMin}
              setAmountMin={setAmountMin}
              amountMax={amountMax}
              setAmountMax={setAmountMax}
              paidFilter={paidFilter}
              setPaidFilter={setPaidFilter}
              sortKey={sortKey}
              sortDir={sortDir}
              setSort={setSort}
              onClear={clearFilters}
              searchPlaceholder="Pesquisar dívidas..."
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

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
