import { getMonthKey } from "@/lib/date-utils";

/**
 * The one definition of "devido" and "pago" in the app.
 *
 * There used to be two independent mechanisms for "this debt is settled" with
 * nothing linking them — `Debt.paid` removed the debt from the sum, and a
 * `Payment` row was subtracted again — so marking installments as paid *and*
 * registering the matching payment deducted the same money twice, with a
 * `Math.max(0, ...)` hiding the negative result as R$ 0,00. The model is now
 * flat: owed is the debts nobody has ticked off, paid is the payments. No
 * subtraction, so double counting is impossible by construction rather than
 * avoided by convention.
 *
 * Marking a debt as paid stays the only thing that clears it from the owed
 * total, which is what the retroactive back-filling workflow relies on.
 *
 * Lives here rather than in the server action because the person and public
 * pages also compute it client-side, scoped to the month picked in the
 * carousel — four readers, one filter.
 */

interface DebtLike {
  amount: number;
  date: Date;
  paid: boolean;
}

interface PaymentLike {
  amount: number;
  date: Date;
}

export interface BalanceTotals {
  totalOwed: number;
  totalPaid: number;
}

/** `monthKey` is a "YYYY-MM" key from date-utils; omit it for the all-time totals. */
export function balanceTotals(
  debts: DebtLike[],
  payments: PaymentLike[],
  monthKey?: string
): BalanceTotals {
  const inMonth = (date: Date) => !monthKey || getMonthKey(date) === monthKey;

  return {
    totalOwed: debts.reduce((sum, d) => (!d.paid && inMonth(d.date) ? sum + d.amount : sum), 0),
    totalPaid: payments.reduce((sum, p) => (inMonth(p.date) ? sum + p.amount : sum), 0),
  };
}
