import { describe, it, expect } from "vitest";
import { splitInstallmentAmounts, installmentDate } from "@/lib/installments";

describe("splitInstallmentAmounts", () => {
  it("splits an evenly divisible total equally", () => {
    expect(splitInstallmentAmounts(300, 3)).toEqual([100, 100, 100]);
  });

  it("puts leftover cents on the last installments", () => {
    expect(splitInstallmentAmounts(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it("sums exactly to the original total regardless of rounding", () => {
    const amounts = splitInstallmentAmounts(19.99, 7);
    const sum = amounts.reduce((acc, n) => acc + Math.round(n * 100), 0);
    expect(sum).toBe(1999);
  });

  it("handles a single installment", () => {
    expect(splitInstallmentAmounts(50, 1)).toEqual([50]);
  });
});

describe("installmentDate", () => {
  it("forward: treats baseDate as installment 1 and steps forward monthly", () => {
    const base = new Date(Date.UTC(2026, 0, 15));
    expect(installmentDate(base, 1, 3, "forward")).toEqual(base);
    expect(installmentDate(base, 2, 3, "forward")).toEqual(new Date(Date.UTC(2026, 1, 15)));
    expect(installmentDate(base, 3, 3, "forward")).toEqual(new Date(Date.UTC(2026, 2, 15)));
  });

  it("forward: clamps day-of-month overflow", () => {
    const base = new Date(Date.UTC(2026, 0, 31));
    expect(installmentDate(base, 2, 3, "forward")).toEqual(new Date(Date.UTC(2026, 1, 28)));
  });

  it("backward: treats baseDate as the last installment and steps backward", () => {
    const base = new Date(Date.UTC(2026, 2, 15));
    expect(installmentDate(base, 3, 3, "backward")).toEqual(base);
    expect(installmentDate(base, 2, 3, "backward")).toEqual(new Date(Date.UTC(2026, 1, 15)));
    expect(installmentDate(base, 1, 3, "backward")).toEqual(new Date(Date.UTC(2026, 0, 15)));
  });
});
