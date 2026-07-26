import { describe, it, expect } from "vitest";
import { formatCurrency, paidPercent } from "@/lib/format-utils";

describe("formatCurrency", () => {
  it("formats with two decimal places", () => {
    expect(formatCurrency(100)).toBe("100.00");
    expect(formatCurrency(99.999)).toBe("100.00");
  });
});

describe("paidPercent", () => {
  it("computes a rounded percentage", () => {
    expect(paidPercent(60, 130)).toBe(46);
    expect(paidPercent(50, 100)).toBe(50);
  });

  it("returns 0 when totalDebt is 0 or negative", () => {
    expect(paidPercent(0, 0)).toBe(0);
    expect(paidPercent(50, 0)).toBe(0);
    expect(paidPercent(50, -10)).toBe(0);
  });

  it("clamps at 100% when overpaid", () => {
    expect(paidPercent(150, 100)).toBe(100);
  });

  it("clamps at 0% when negative", () => {
    expect(paidPercent(-10, 100)).toBe(0);
  });
});
