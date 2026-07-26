"use client";

import { useMemo, useState } from "react";
import { getMonthKey, toDateInputValue } from "@/lib/date-utils";

export type SortKey = "date" | "amount";
export type SortDir = "asc" | "desc";
export type PaidFilter = "all" | "paid" | "unpaid";

export function parseAmountFilter(s: string): { val: number; isInt: boolean } {
  const n = s.replace(",", ".");
  return { val: parseFloat(n), isInt: !n.includes(".") };
}

export function useSort() {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return { sortKey, sortDir, setSort, setSortKey, setSortDir };
}

interface UseFilteredSortedListConfig<T> {
  items: T[];
  /** Month-carousel filter (e.g. "2026-03"), applied before every other filter. */
  selectedMonth?: string;
  getDate: (item: T) => Date;
  getAmount: (item: T) => number;
  getSearchText: (item: T) => string[];
  /** Omit for lists with no paid/unpaid concept (payments). */
  getPaid?: (item: T) => boolean;
  /** Dashboard sections keep a manual date-range filter alongside the month
   * carousel; public-view dropped it in favor of the carousel alone. */
  hasDateRange?: boolean;
}

/**
 * Search/amount-range/paid-status/date-range filtering plus date-or-amount
 * sorting, shared by debts-section.tsx, payments-section.tsx, and
 * public-view.tsx's DebtsList/PaymentsList — previously four near-identical
 * copies of this same filter pipeline.
 */
export function useFilteredSortedList<T>({
  items,
  selectedMonth,
  getDate,
  getAmount,
  getSearchText,
  getPaid,
  hasDateRange,
}: UseFilteredSortedListConfig<T>) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");
  const { sortKey, sortDir, setSort, setSortKey, setSortDir } = useSort();

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setPaidFilter("all");
    setSortKey("date");
    setSortDir("desc");
  }

  const monthItems = useMemo(
    () => (selectedMonth ? items.filter((item) => getMonthKey(getDate(item)) === selectedMonth) : items),
    [items, selectedMonth, getDate]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = amountMin ? parseAmountFilter(amountMin) : null;
    const amtMax = amountMax ? parseAmountFilter(amountMax) : null;

    const list = monthItems.filter((item) => {
      if (getPaid) {
        const paid = getPaid(item);
        if (paidFilter === "paid" && !paid) return false;
        if (paidFilter === "unpaid" && paid) return false;
      }
      if (q) {
        const hit = getSearchText(item).some((s) => s.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (hasDateRange) {
        const dateStr = toDateInputValue(getDate(item));
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
      }
      const amount = getAmount(item);
      if (amtMin && !isNaN(amtMin.val)) {
        if ((amtMin.isInt ? Math.floor(amount) : amount) < amtMin.val) return false;
      }
      if (amtMax && !isNaN(amtMax.val)) {
        if ((amtMax.isInt ? Math.floor(amount) : amount) > amtMax.val) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const av = sortKey === "amount" ? getAmount(a) : getDate(a).getTime();
      const bv = sortKey === "amount" ? getAmount(b) : getDate(b).getTime();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [monthItems, search, dateFrom, dateTo, amountMin, amountMax, paidFilter, sortKey, sortDir, getAmount, getDate, getSearchText, getPaid, hasDateRange]);

  const filtersActive = Boolean(
    search || dateFrom || dateTo || amountMin || amountMax || (getPaid && paidFilter !== "all")
  );

  return {
    monthItems,
    filtered,
    filtersActive,
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
  };
}
