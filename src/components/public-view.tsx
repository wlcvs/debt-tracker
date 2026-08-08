"use client";

import { useMemo, useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useFilteredSortedList } from "@/lib/hooks/use-list-filter-sort";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import type { PersonWithBalance } from "@/lib/actions/person";
import { getAvailableMonths, getMonthKey, formatDateBR } from "@/lib/date-utils";
import { balanceTotals } from "@/lib/balance";
import { formatCurrency, amountSearchTexts } from "@/lib/format-utils";
import { MonthCarousel } from "@/components/month-carousel";
import { FilterFields } from "@/components/filter-fields";
import { ModalShell } from "@/components/modal-shell";
import { BalanceSummary } from "@/components/balance-summary";
import { Badge } from "@/components/badge";

type DebtorView = Pick<PersonWithBalance, "name" | "totalOwed" | "debts" | "payments">;

interface Props {
  debtor: DebtorView;
}

type Debt = DebtorView["debts"][number];
type Payment = DebtorView["payments"][number];

const methodLabel = (m: string) => PAYMENT_METHODS[m as PaymentMethodKey] ?? m;

export function PublicView({ debtor }: Props) {
  const [openDebt, setOpenDebt] = useState<Debt | null>(null);
  const [openPayment, setOpenPayment] = useState<Payment | null>(null);

  const months = useMemo(
    () => getAvailableMonths([...debtor.debts.map((d) => d.date), ...debtor.payments.map((p) => p.date)], new Date()),
    [debtor.debts, debtor.payments]
  );
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));

  // The two lists below follow the carousel, so the summary above them has to
  // as well — an all-time total there never matched what was on screen.
  const monthTotals = useMemo(
    () => balanceTotals(debtor.debts, debtor.payments, selectedMonth),
    [debtor.debts, debtor.payments, selectedMonth]
  );

  return (
    <>
      <h2 className="text-lg tracking-widest uppercase text-zinc-900 dark:text-white mb-8">{debtor.name}</h2>

      {/* The summary sits under the carousel, not beside the name: these are
          the selected month's totals, so they belong to the month picker. */}
      <div className="flex flex-col gap-4 mb-6">
        <MonthCarousel months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
        <div className="flex justify-end">
          <BalanceSummary totalOwed={monthTotals.totalOwed} totalPaid={monthTotals.totalPaid} />
        </div>
      </div>

      <DebtsList debts={debtor.debts} onOpen={setOpenDebt} selectedMonth={selectedMonth} />
      <div className="border-t border-zinc-300 dark:border-zinc-700 mb-8" />
      <PaymentsList payments={debtor.payments} onOpen={setOpenPayment} selectedMonth={selectedMonth} />
      {/* All-time, not monthTotals: this simulates paying off the whole
          balance, which doesn't change with the month being browsed. */}
      {debtor.totalOwed > 0 && <InstallmentCalculator balance={debtor.totalOwed} />}

      {openDebt && <PublicDebtModal debt={openDebt} onClose={() => setOpenDebt(null)} />}
      {openPayment && <PublicPaymentModal payment={openPayment} onClose={() => setOpenPayment(null)} />}
    </>
  );
}

// ── Debts ────────────────────────────────────────────────────────────────────

function DebtsList({ debts, onOpen, selectedMonth }: { debts: Debt[]; onOpen: (d: Debt) => void; selectedMonth: string }) {
  const [showFilters, setShowFilters] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapperRef, () => setShowFilters(false), { escape: false });

  const {
    monthItems: monthDebts,
    filtered,
    filtersActive: filterValuesActive,
    search,
    setSearch,
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
    getDate: (d) => d.date,
    getAmount: (d) => d.amount,
    getPaid: (d) => d.paid,
    getSearchText: (d) => [
      d.title,
      d.description,
      d.creditCardLabel ?? (d.method ? methodLabel(d.method) : ""),
      ...amountSearchTexts(d.amount),
    ],
  });

  const filtersActive = Boolean(showFilters || filterValuesActive);

  return (
    <div className="mb-2">
      <Collapsible.Root open={showFilters} onOpenChange={setShowFilters} ref={wrapperRef}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Dívidas</p>
          {monthDebts.length > 0 && (
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
          )}
        </div>

        <Collapsible.Content>
          <div className="mb-3">
            <FilterFields
              search={search}
              setSearch={setSearch}
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

      {monthDebts.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">Nenhuma dívida neste mês.</p>
      ) : (
        <ul className="flex flex-col">
          {filtered.map((debt) => (
            <li key={debt.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
              <button
                type="button"
                onClick={() => onOpen(debt)}
                className="w-full flex items-start justify-between gap-4 py-2.5 hover:opacity-60 transition-opacity text-left cursor-pointer"
              >
                <div className="flex flex-col min-w-0">
                  {(debt.creditCardLabel || debt.method) && (
                    <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600">
                      {debt.creditCardLabel ?? methodLabel(debt.method!)}
                    </span>
                  )}
                  <span className={`flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 truncate${debt.paid ? " line-through opacity-50" : ""}`}>
                    {debt.title}
                    {debt.installmentGroupId && (
                      <Badge className="px-1 shrink-0 no-underline">
                        {debt.installmentIndex}/{debt.installmentTotal}
                      </Badge>
                    )}
                  </span>
                  {debt.description && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{debt.description}</span>
                  )}
                </div>
                <span className={`shrink-0 text-xs tracking-tight text-zinc-700 dark:text-zinc-300 mt-0.5${debt.paid ? " line-through opacity-50" : ""}`}>
                  R$ {formatCurrency(debt.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Payments ─────────────────────────────────────────────────────────────────

function PaymentsList({ payments, onOpen, selectedMonth }: { payments: Payment[]; onOpen: (p: Payment) => void; selectedMonth: string }) {
  const [showFilters, setShowFilters] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapperRef, () => setShowFilters(false), { escape: false });

  const {
    monthItems: monthPayments,
    filtered,
    filtersActive: filterValuesActive,
    search,
    setSearch,
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
    getDate: (p) => p.date,
    getAmount: (p) => p.amount,
    getSearchText: (p) => [p.description, methodLabel(p.method), ...amountSearchTexts(p.amount)],
  });

  const filtersActive = Boolean(showFilters || filterValuesActive);

  return (
    <div className="mb-2">
      <Collapsible.Root open={showFilters} onOpenChange={setShowFilters} ref={wrapperRef}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Pagamentos</p>
          {monthPayments.length > 0 && (
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
          )}
        </div>

        <Collapsible.Content>
          <div className="mb-3">
            <FilterFields
              search={search}
              setSearch={setSearch}
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

      {monthPayments.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">Nenhum pagamento neste mês.</p>
      ) : (
        <ul className="flex flex-col">
          {filtered.map((payment) => (
            <li key={payment.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
              <button
                type="button"
                onClick={() => onOpen(payment)}
                className="w-full flex items-start justify-between gap-4 py-2.5 hover:opacity-60 transition-opacity text-left cursor-pointer"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600">
                    {methodLabel(payment.method)}
                  </span>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">R$ {formatCurrency(payment.amount)}</span>
                  {payment.description && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{payment.description}</span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">
                  {formatDateBR(payment.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Modals (read-only) ───────────────────────────────────────────────────────

function PublicDebtModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const badgeLabel = debt.creditCardLabel ?? (debt.method ? methodLabel(debt.method) : null);

  return (
    <ModalShell eyebrow="Dívida" onClose={onClose}>
        <div className="px-6 py-5">
          <p className={`text-sm tracking-widest uppercase mb-1 ${debt.paid ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-white"}`}>
            {debt.title}
          </p>
          <p className={`text-3xl tracking-tight mb-3 ${debt.paid ? "text-zinc-400 dark:text-zinc-600 line-through" : "text-zinc-900 dark:text-white"}`}>
            R$ {formatCurrency(debt.amount)}
          </p>
          {debt.description && (
            <p className="text-xs tracking-wider text-zinc-500 dark:text-zinc-400 -mt-2 mb-2">{debt.description}</p>
          )}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(debt.date)}</span>
            {badgeLabel && <Badge>{badgeLabel}</Badge>}
            {debt.installmentGroupId && (
              <Badge>
                Parcela {debt.installmentIndex}/{debt.installmentTotal}
              </Badge>
            )}
          </div>
          {debt.paid && <p className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Paga</p>}
        </div>
    </ModalShell>
  );
}

function PublicPaymentModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  return (
    <ModalShell eyebrow="Pagamento" onClose={onClose}>
        <div className="px-6 py-5">
          <p className="text-3xl tracking-tight text-zinc-900 dark:text-white mb-3">R$ {formatCurrency(payment.amount)}</p>
          {payment.description && (
            <p className="text-xs tracking-wider text-zinc-500 dark:text-zinc-400 -mt-2 mb-2">{payment.description}</p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(payment.date)}</span>
            <Badge>{methodLabel(payment.method)}</Badge>
          </div>
        </div>
    </ModalShell>
  );
}

// ── Installment calculator ───────────────────────────────────────────────────

function InstallmentCalculator({ balance }: { balance: number }) {
  const [months, setMonths] = useState(12);

  const monthly = useMemo(() => {
    if (!months || months <= 0 || balance <= 0) return null;
    return (balance / months).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [months, balance]);

  return (
    <div className="border-t border-zinc-300 dark:border-zinc-700 pt-5">
      <p className="text-sm tracking-[0.2em] uppercase text-zinc-600 dark:text-zinc-400 mb-4">Simule o parcelamento</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Not a plain button row: ToggleGroup adds roving tabindex, arrow-key
            navigation and aria-checked. The value can also be set by the number
            input beside it, so it clears when months is something else — hence
            String(months) rather than a separate selected state. */}
        <ToggleGroup.Root
          type="single"
          value={[3, 6, 12].includes(months) ? String(months) : ""}
          onValueChange={(v) => { if (v) setMonths(Number(v)); }}
          aria-label="Número de parcelas"
          className="flex gap-2"
        >
          {[3, 6, 12].map((n) => (
            <ToggleGroup.Item
              key={n}
              value={String(n)}
              className="px-4 py-2 border text-xs tracking-widest hover:border-zinc-600 hover:text-zinc-700 dark:hover:border-zinc-400 dark:hover:text-zinc-300 transition-colors cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 data-[state=on]:border-zinc-600 dark:data-[state=on]:border-zinc-400 data-[state=on]:text-zinc-700 dark:data-[state=on]:text-zinc-300"
            >
              {n}x
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <div className="flex items-stretch border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
          <button
            type="button"
            onClick={() => setMonths((m) => Math.max(1, m - 1))}
            className="px-2 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            aria-label="Diminuir meses"
          >
            −
          </button>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            min={1}
            max={360}
            className="w-14 bg-transparent border-x border-zinc-300 dark:border-zinc-700 px-1 py-2 text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setMonths((m) => Math.min(360, m + 1))}
            className="px-2 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            aria-label="Aumentar meses"
          >
            +
          </button>
        </div>
      </div>
      <p className="text-2xl tracking-tight text-zinc-900 dark:text-white">
        R$ {monthly ?? "—"} <span className="text-sm tracking-wider text-zinc-400 dark:text-zinc-600">/mês</span>
      </p>
    </div>
  );
}
