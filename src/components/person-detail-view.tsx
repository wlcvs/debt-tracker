"use client";

import { useMemo, useState } from "react";
import { DebtsSection } from "@/components/debts-section";
import { PaymentsSection } from "@/components/payments-section";
import { MonthCarousel } from "@/components/month-carousel";
import { BalanceSummary } from "@/components/balance-summary";
import { EditablePersonHeader } from "@/components/editable-person-header";
import { ShareButton } from "@/components/share-button";
import { PersonVisibilityToggle } from "@/components/person-visibility-toggle";
import { PersonActions } from "@/components/person-actions";
import { getAvailableMonths, getMonthKey } from "@/lib/date-utils";
import { balanceTotals } from "@/lib/balance";
import type { PersonWithBalance } from "@/lib/actions/person";

interface Props {
  person: PersonWithBalance;
  creditCards: { id: string; label: string }[];
}

/**
 * Owns the selected month for the whole person page.
 *
 * The header used to be rendered by the route's Server Component, which left
 * the balance summary showing all-time totals while the lists right below it
 * were scoped to one month. The state can't be lifted into a Server Component,
 * so the header came down here instead — everything in that row is a client
 * component already.
 */
export function PersonDetailView({ person, creditCards }: Props) {
  const { accessCode, debts, payments } = person;

  const months = useMemo(
    () => getAvailableMonths([...debts.map((d) => d.date), ...payments.map((p) => p.date)], new Date()),
    [debts, payments]
  );
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));

  const monthTotals = useMemo(
    () => balanceTotals(debts, payments, selectedMonth),
    [debts, payments, selectedMonth]
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 flex flex-col gap-3">
        <EditablePersonHeader person={person} />
        <div className="flex items-center gap-3">
          <ShareButton accessCode={accessCode} />
          <PersonVisibilityToggle accessCode={accessCode} publicVisible={person.publicVisible} />
          <PersonActions person={person} />
        </div>
      </div>

      {/* The summary sits under the carousel, not up in the header: these are
          the selected month's totals, so they belong to the month picker
          rather than to the person's name. */}
      <div className="flex flex-col gap-4">
        <MonthCarousel months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
        <div className="flex justify-end">
          <BalanceSummary totalOwed={monthTotals.totalOwed} totalPaid={monthTotals.totalPaid} size="text-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
        <DebtsSection accessCode={accessCode} debts={debts} creditCards={creditCards} selectedMonth={selectedMonth} />
        <PaymentsSection accessCode={accessCode} payments={payments} selectedMonth={selectedMonth} />
      </div>
    </div>
  );
}
