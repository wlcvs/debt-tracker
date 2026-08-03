"use client";

import { useMemo, useState } from "react";
import { DebtsSection } from "@/components/debts-section";
import { PaymentsSection } from "@/components/payments-section";
import { MonthCarousel } from "@/components/month-carousel";
import { getAvailableMonths, getMonthKey } from "@/lib/date-utils";
import type { PersonWithBalance } from "@/lib/actions/person";

interface Props {
  accessCode: string;
  debts: PersonWithBalance["debts"];
  payments: PersonWithBalance["payments"];
  creditCards: { id: string; label: string }[];
}

export function PersonMonthView({ accessCode, debts, payments, creditCards }: Props) {
  const months = useMemo(
    () => getAvailableMonths([...debts.map((d) => d.date), ...payments.map((p) => p.date)], new Date()),
    [debts, payments]
  );
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <MonthCarousel months={months} selected={selectedMonth} onSelect={setSelectedMonth} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
        <DebtsSection accessCode={accessCode} debts={debts} creditCards={creditCards} selectedMonth={selectedMonth} />
        <PaymentsSection accessCode={accessCode} payments={payments} selectedMonth={selectedMonth} />
      </div>
    </div>
  );
}
