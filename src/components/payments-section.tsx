"use client";

import { useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EditablePayment } from "@/components/editable-payment";
import { CreatePaymentForm } from "@/components/create-payment-form";
import { FilterFields } from "@/components/filter-fields";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import { formatCurrency } from "@/lib/format-utils";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useFilteredSortedList } from "@/lib/hooks/use-list-filter-sort";

interface Payment {
  id: string;
  amount: number;
  description: string;
  date: Date;
  method: string;
}

interface Props {
  accessCode: string;
  payments: Payment[];
  selectedMonth?: string;
}

export function PaymentsSection({ accessCode, payments, selectedMonth }: Props) {
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
    sortKey,
    sortDir,
    setSort,
    clearFilters,
  } = useFilteredSortedList({
    items: payments,
    selectedMonth,
    hasDateRange: true,
    getDate: (p) => p.date,
    getAmount: (p) => p.amount,
    getSearchText: (p) => [
      p.description,
      PAYMENT_METHODS[p.method as PaymentMethodKey] ?? p.method,
      formatCurrency(p.amount).replace(".", ","),
    ],
  });

  const filtersActive = Boolean(showFilters || filterValuesActive);

  return (
    <section className="flex flex-col gap-4 border border-zinc-300 dark:border-zinc-700 p-4">
      <Collapsible.Root open={showFilters} onOpenChange={setShowFilters} ref={wrapperRef}>
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Pagamentos</p>
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
              sortKey={sortKey}
              sortDir={sortDir}
              setSort={setSort}
              onClear={clearFilters}
              searchPlaceholder="Pesquisar pagamentos..."
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {filtered.length > 0 && (
        <ul className="flex flex-col">
          {filtered.map((payment) => (
            <EditablePayment key={payment.id} payment={payment} />
          ))}
        </ul>
      )}

      <CreatePaymentForm accessCode={accessCode} />
    </section>
  );
}
