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
