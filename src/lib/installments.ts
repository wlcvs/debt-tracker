import { addMonthsClamped } from "@/lib/date-utils";

export function splitInstallmentAmounts(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const amounts: number[] = [];
  for (let i = 0; i < count; i++) {
    const cents = base + (i >= count - remainder ? 1 : 0);
    amounts.push(cents / 100);
  }
  return amounts;
}

export type InstallmentDirection = "forward" | "backward";

export function installmentDate(baseDate: Date, index: number, total: number, direction: InstallmentDirection): Date {
  return direction === "forward" ? addMonthsClamped(baseDate, index - 1) : addMonthsClamped(baseDate, index - total);
}
