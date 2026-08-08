import { addMonthsClamped } from "@/lib/date-utils";

// The total rarely divides evenly, so some installments carry an extra cent.
// They go on the *first* ones, matching how Brazilian card issuers split a
// purchase (685,91 in 10x -> 68,60 + 9x 68,59). The sum always equals the
// total that was typed.
export function splitInstallmentAmounts(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const amounts: number[] = [];
  for (let i = 0; i < count; i++) {
    const cents = base + (i < remainder ? 1 : 0);
    amounts.push(cents / 100);
  }
  return amounts;
}

export type InstallmentDirection = "forward" | "backward";

export function installmentDate(baseDate: Date, index: number, total: number, direction: InstallmentDirection): Date {
  return direction === "forward" ? addMonthsClamped(baseDate, index - 1) : addMonthsClamped(baseDate, index - total);
}

export const MIN_INSTALLMENTS = 1;
export const MAX_INSTALLMENTS = 60;

// The count is held as raw text wherever it's typed, so the field can be
// emptied and retyped. Clamping on every keystroke destroyed input: with 21 on
// screen, one more digit made "219", which snapped to 60 and swallowed every
// following keystroke. Normalization happens on blur instead. Lives here
// rather than in debt-form.tsx because the installment-group edit form needs
// the identical field.
export function clampInstallments(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_INSTALLMENTS) return String(MIN_INSTALLMENTS);
  return String(Math.min(MAX_INSTALLMENTS, Math.trunc(n)));
}

/**
 * The rows a parceled purchase should consist of, given its total, count and
 * first date. Shared by createDebt, updateDebtInstallmentGroup and the two
 * forms' previews, so none of them can drift on how a purchase is split.
 */
export function buildInstallments(
  total: number,
  count: number,
  baseDate: Date,
  direction: InstallmentDirection = "forward"
): { index: number; amount: number; date: Date }[] {
  return splitInstallmentAmounts(total, count).map((amount, i) => ({
    index: i + 1,
    amount,
    date: installmentDate(baseDate, i + 1, count, direction),
  }));
}
