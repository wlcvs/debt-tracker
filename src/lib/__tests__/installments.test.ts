import { describe, it, expect } from "vitest";
import {
  splitInstallmentAmounts,
  installmentDate,
  buildInstallments,
  clampInstallments,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
} from "@/lib/installments";

describe("splitInstallmentAmounts", () => {
  it("splits an evenly divisible total equally", () => {
    expect(splitInstallmentAmounts(300, 3)).toEqual([100, 100, 100]);
  });

  it("puts leftover cents on the first installments", () => {
    expect(splitInstallmentAmounts(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("sums exactly to the original total regardless of rounding", () => {
    const amounts = splitInstallmentAmounts(19.99, 7);
    const sum = amounts.reduce((acc, n) => acc + Math.round(n * 100), 0);
    expect(sum).toBe(1999);
  });

  it("handles a single installment", () => {
    expect(splitInstallmentAmounts(50, 1)).toEqual([50]);
  });

  it("returns an empty array for count=0", () => {
    expect(splitInstallmentAmounts(100, 0)).toEqual([]);
  });

  it("returns all zeros for total=0", () => {
    expect(splitInstallmentAmounts(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("preserves sign across installments for a negative total", () => {
    const amounts = splitInstallmentAmounts(-100, 3);
    expect(amounts).toEqual([-33.33, -33.33, -33.34]);
    const sum = amounts.reduce((acc, n) => acc + Math.round(n * 100), 0);
    expect(sum).toBe(-10000);
  });

  it("puts a 1-cent remainder only on the first installment (count=4)", () => {
    // 400.01 -> 40001 cents / 4 = base 10000, remainder 1
    expect(splitInstallmentAmounts(400.01, 4)).toEqual([100.01, 100, 100, 100]);
  });

  it("puts a 3-cent remainder on the first three installments (count=4)", () => {
    // 400.03 -> 40003 cents / 4 = base 10000, remainder 3
    expect(splitInstallmentAmounts(400.03, 4)).toEqual([100.01, 100.01, 100.01, 100]);
  });

  it("sum is invariant for a large count (24)", () => {
    const amounts = splitInstallmentAmounts(999.95, 24);
    const sum = amounts.reduce((acc, n) => acc + Math.round(n * 100), 0) / 100;
    expect(sum).toBe(999.95);
  });

  it("sum is invariant for a large count (60)", () => {
    const amounts = splitInstallmentAmounts(12345.67, 60);
    const sum = amounts.reduce((acc, n) => acc + Math.round(n * 100), 0) / 100;
    expect(sum).toBe(12345.67);
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

  it("total=1: index 1 equals baseDate exactly in forward mode", () => {
    const base = new Date(Date.UTC(2026, 3, 10));
    expect(installmentDate(base, 1, 1, "forward")).toEqual(base);
  });

  it("total=1: index 1 equals baseDate exactly in backward mode", () => {
    const base = new Date(Date.UTC(2026, 3, 10));
    expect(installmentDate(base, 1, 1, "backward")).toEqual(base);
  });

  it("backward: clamps day-of-month overflow (Mar 31 base, index 2 of 3 lands in Feb)", () => {
    const base = new Date(Date.UTC(2026, 2, 31));
    expect(installmentDate(base, 2, 3, "backward")).toEqual(new Date(Date.UTC(2026, 1, 28)));
  });

  it("out-of-range index=0 (documenting actual behavior: steps one month before installment 1)", () => {
    const base = new Date(Date.UTC(2026, 3, 10));
    expect(installmentDate(base, 0, 3, "forward")).toEqual(new Date(Date.UTC(2026, 2, 10)));
  });

  it("forward: crosses a year boundary (base in November)", () => {
    const base = new Date(Date.UTC(2026, 10, 15));
    expect(installmentDate(base, 3, 3, "forward")).toEqual(new Date(Date.UTC(2027, 0, 15)));
  });

  it("backward: crosses a year boundary (base in February)", () => {
    const base = new Date(Date.UTC(2026, 1, 15));
    expect(installmentDate(base, 1, 3, "backward")).toEqual(new Date(Date.UTC(2025, 11, 15)));
  });
});

describe("buildInstallments", () => {
  it("pairs each split amount with its own date", () => {
    const base = new Date(Date.UTC(2026, 2, 10));
    expect(buildInstallments(300, 3, base)).toEqual([
      { index: 1, amount: 100, date: new Date(Date.UTC(2026, 2, 10)) },
      { index: 2, amount: 100, date: new Date(Date.UTC(2026, 3, 10)) },
      { index: 3, amount: 100, date: new Date(Date.UTC(2026, 4, 10)) },
    ]);
  });

  it("defaults to forward, and honours backward when asked", () => {
    const base = new Date(Date.UTC(2026, 2, 10));
    expect(buildInstallments(200, 2, base)[0].date).toEqual(new Date(Date.UTC(2026, 2, 10)));
    expect(buildInstallments(200, 2, base, "backward")[0].date).toEqual(new Date(Date.UTC(2026, 1, 10)));
  });

  // The whole point of the shared helper: the create form's preview, the group
  // edit form's preview and both server actions must agree row for row.
  it("matches splitInstallmentAmounts and installmentDate exactly", () => {
    const base = new Date(Date.UTC(2026, 0, 31));
    const rows = buildInstallments(685.91, 10, base);
    expect(rows.map((r) => r.amount)).toEqual(splitInstallmentAmounts(685.91, 10));
    expect(rows.map((r) => r.date)).toEqual(
      rows.map((r) => installmentDate(base, r.index, 10, "forward"))
    );
  });
});

describe("clampInstallments", () => {
  it("keeps a value already inside the range", () => {
    expect(clampInstallments("12")).toBe("12");
  });

  it("floors anything below the minimum, including empty and zero", () => {
    for (const raw of ["", "0", "-3", "abc"]) {
      expect(clampInstallments(raw)).toBe(String(MIN_INSTALLMENTS));
    }
  });

  it("caps at the maximum", () => {
    expect(clampInstallments("219")).toBe(String(MAX_INSTALLMENTS));
  });

  it("truncates a fractional count rather than rounding", () => {
    expect(clampInstallments("3.9")).toBe("3");
  });
});
