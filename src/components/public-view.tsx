"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";
import type { PersonWithBalance } from "@/lib/actions/person";
import { getAvailableMonths, getMonthKey, formatDateBR } from "@/lib/date-utils";
import { MonthCarousel } from "@/components/month-carousel";

type DebtorView = Pick<PersonWithBalance, "name" | "totalOwed" | "debts" | "payments">;

interface Props {
  debtor: DebtorView;
}

type Debt = DebtorView["debts"][number];
type Payment = DebtorView["payments"][number];

const methodLabel = (m: string) => PAYMENT_METHODS[m as PaymentMethodKey] ?? m;

function parseAmountFilter(s: string): { val: number; isInt: boolean } {
  const n = s.replace(",", ".");
  return { val: parseFloat(n), isInt: !n.includes(".") };
}

function useSort() {
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function setSort(key: "date" | "amount") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return { sortKey, sortDir, setSort, setSortKey, setSortDir };
}

export function PublicView({ debtor }: Props) {
  const [openDebt, setOpenDebt] = useState<Debt | null>(null);
  const [openPayment, setOpenPayment] = useState<Payment | null>(null);

  const months = useMemo(
    () => getAvailableMonths([...debtor.debts.map((d) => d.date), ...debtor.payments.map((p) => p.date)], new Date()),
    [debtor.debts, debtor.payments]
  );
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));

  return (
    <>
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <h2 className="text-lg tracking-widest uppercase text-zinc-900 dark:text-white">{debtor.name}</h2>
        <p className="text-lg tracking-tight text-zinc-900 dark:text-white shrink-0">R$ {debtor.totalOwed.toFixed(2)}</p>
      </div>

      <div className="mb-6">
        <MonthCarousel months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
      </div>

      <DebtsList debts={debtor.debts} onOpen={setOpenDebt} selectedMonth={selectedMonth} />
      <div className="border-t border-zinc-300 dark:border-zinc-700 mb-8" />
      <PaymentsList payments={debtor.payments} onOpen={setOpenPayment} selectedMonth={selectedMonth} />
      {debtor.totalOwed > 0 && <InstallmentCalculator balance={debtor.totalOwed} />}

      {openDebt && <PublicDebtModal debt={openDebt} onClose={() => setOpenDebt(null)} />}
      {openPayment && <PublicPaymentModal payment={openPayment} onClose={() => setOpenPayment(null)} />}
    </>
  );
}

// ── Debts ────────────────────────────────────────────────────────────────────

function DebtsList({ debts, onOpen, selectedMonth }: { debts: Debt[]; onOpen: (d: Debt) => void; selectedMonth: string }) {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">("all");
  const { sortKey, sortDir, setSort, setSortKey, setSortDir } = useSort();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function clearFilters() {
    setSearch("");
    setAmountMin("");
    setAmountMax("");
    setPaidFilter("all");
    setSortKey("date");
    setSortDir("desc");
  }

  const monthDebts = useMemo(() => debts.filter((d) => getMonthKey(d.date) === selectedMonth), [debts, selectedMonth]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = amountMin ? parseAmountFilter(amountMin) : null;
    const amtMax = amountMax ? parseAmountFilter(amountMax) : null;

    const list = monthDebts.filter((d) => {
      if (paidFilter === "paid" && !d.paid) return false;
      if (paidFilter === "unpaid" && d.paid) return false;
      const method = d.creditCardLabel ?? (d.method ? methodLabel(d.method) : "");
      if (q) {
        const amtStr = d.amount.toFixed(2).replace(".", ",");
        const hit = [d.title, d.description, method, amtStr].some((s) => s.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (amtMin && !isNaN(amtMin.val)) {
        if ((amtMin.isInt ? Math.floor(d.amount) : d.amount) < amtMin.val) return false;
      }
      if (amtMax && !isNaN(amtMax.val)) {
        if ((amtMax.isInt ? Math.floor(d.amount) : d.amount) > amtMax.val) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const av = sortKey === "amount" ? a.amount : a.date.getTime();
      const bv = sortKey === "amount" ? b.amount : b.date.getTime();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [monthDebts, search, amountMin, amountMax, paidFilter, sortKey, sortDir]);

  const filtersActive = Boolean(showFilters || search || amountMin || amountMax || paidFilter !== "all");

  return (
    <div className="mb-2">
      <div ref={wrapperRef}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Dívidas</p>
          {monthDebts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`text-[10px] tracking-widest uppercase hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
                filtersActive ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              Filtros
            </button>
          )}
        </div>

        {showFilters && (
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
        )}
      </div>

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
                      <span className="shrink-0 text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1 py-0.5 no-underline">
                        {debt.installmentIndex}/{debt.installmentTotal}
                      </span>
                    )}
                  </span>
                  {debt.description && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{debt.description}</span>
                  )}
                </div>
                <span className={`shrink-0 text-xs tracking-tight text-zinc-700 dark:text-zinc-300 mt-0.5${debt.paid ? " line-through opacity-50" : ""}`}>
                  R$ {debt.amount.toFixed(2)}
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
  const [search, setSearch] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const { sortKey, sortDir, setSort, setSortKey, setSortDir } = useSort();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function clearFilters() {
    setSearch("");
    setAmountMin("");
    setAmountMax("");
    setSortKey("date");
    setSortDir("desc");
  }

  const monthPayments = useMemo(() => payments.filter((p) => getMonthKey(p.date) === selectedMonth), [payments, selectedMonth]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = amountMin ? parseAmountFilter(amountMin) : null;
    const amtMax = amountMax ? parseAmountFilter(amountMax) : null;

    const list = monthPayments.filter((p) => {
      if (q) {
        const amtStr = p.amount.toFixed(2).replace(".", ",");
        const hit = [p.description, methodLabel(p.method), amtStr].some((s) => s.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (amtMin && !isNaN(amtMin.val)) {
        if ((amtMin.isInt ? Math.floor(p.amount) : p.amount) < amtMin.val) return false;
      }
      if (amtMax && !isNaN(amtMax.val)) {
        if ((amtMax.isInt ? Math.floor(p.amount) : p.amount) > amtMax.val) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const av = sortKey === "amount" ? a.amount : a.date.getTime();
      const bv = sortKey === "amount" ? b.amount : b.date.getTime();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [monthPayments, search, amountMin, amountMax, sortKey, sortDir]);

  const filtersActive = Boolean(showFilters || search || amountMin || amountMax);

  return (
    <div className="mb-2">
      <div ref={wrapperRef}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">Pagamentos</p>
          {monthPayments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`text-[10px] tracking-widest uppercase hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
                filtersActive ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              Filtros
            </button>
          )}
        </div>

        {showFilters && (
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
        )}
      </div>

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
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">R$ {payment.amount.toFixed(2)}</span>
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

// ── Shared filter fields ─────────────────────────────────────────────────────

interface FilterFieldsProps {
  search: string;
  setSearch: (v: string) => void;
  amountMin: string;
  setAmountMin: (v: string) => void;
  amountMax: string;
  setAmountMax: (v: string) => void;
  paidFilter?: "all" | "paid" | "unpaid";
  setPaidFilter?: (v: "all" | "paid" | "unpaid") => void;
  sortKey: "date" | "amount";
  sortDir: "asc" | "desc";
  setSort: (key: "date" | "amount") => void;
  onClear: () => void;
  searchPlaceholder: string;
}

function FilterFields(props: FilterFieldsProps) {
  return (
    <div className="flex flex-col gap-2 mb-3">
      <input
        type="search"
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        placeholder={props.searchPlaceholder}
        className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
      />
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
          {(["all", "paid", "unpaid"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => props.setPaidFilter?.(key)}
              className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                props.paidFilter === key ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
              }`}
            >
              {key === "all" ? "Todas" : key === "paid" ? "Pagas" : "Não pagas"}
            </button>
          ))}
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
          Data {props.sortKey === "date" ? (props.sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button
          type="button"
          onClick={() => props.setSort("amount")}
          className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
            props.sortKey === "amount" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400"
          }`}
        >
          Valor {props.sortKey === "amount" ? (props.sortDir === "asc" ? "↑" : "↓") : ""}
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

// ── Modals (read-only) ───────────────────────────────────────────────────────

function PublicDebtModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const badgeLabel = debt.creditCardLabel ?? (debt.method ? methodLabel(debt.method) : null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Dívida</p>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <p className={`text-sm tracking-widest uppercase mb-1 ${debt.paid ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-white"}`}>
            {debt.title}
          </p>
          <p className={`text-3xl tracking-tight mb-3 ${debt.paid ? "text-zinc-400 dark:text-zinc-600 line-through" : "text-zinc-900 dark:text-white"}`}>
            R$ {debt.amount.toFixed(2)}
          </p>
          {debt.description && (
            <p className="text-xs tracking-wider text-zinc-500 dark:text-zinc-400 -mt-2 mb-2">{debt.description}</p>
          )}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(debt.date)}</span>
            {badgeLabel && (
              <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
                {badgeLabel}
              </span>
            )}
            {debt.installmentGroupId && (
              <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
                Parcela {debt.installmentIndex}/{debt.installmentTotal}
              </span>
            )}
          </div>
          {debt.paid && <p className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600">✓ Paga</p>}
        </div>
      </div>
    </div>
  );
}

function PublicPaymentModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Pagamento</p>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-3xl tracking-tight text-zinc-900 dark:text-white mb-3">R$ {payment.amount.toFixed(2)}</p>
          {payment.description && (
            <p className="text-xs tracking-wider text-zinc-500 dark:text-zinc-400 -mt-2 mb-2">{payment.description}</p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 dark:text-zinc-600">{formatDateBR(payment.date)}</span>
            <span className="text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5">
              {methodLabel(payment.method)}
            </span>
          </div>
        </div>
      </div>
    </div>
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
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setMonths(n)}
            className={`px-4 py-2 border text-xs tracking-widest hover:border-zinc-600 hover:text-zinc-700 dark:hover:border-zinc-400 dark:hover:text-zinc-300 transition-colors cursor-pointer ${
              months === n ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-300" : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600"
            }`}
          >
            {n}x
          </button>
        ))}
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
