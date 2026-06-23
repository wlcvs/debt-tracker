import { describe, it, expect } from "vitest";
import { calculateCoveredDebtIds } from "../debt-allocation";

describe("calculateCoveredDebtIds", () => {
  it("returns empty set when no debts", () => {
    const result = calculateCoveredDebtIds([], 100);
    expect(result.size).toBe(0);
  });

  it("returns empty set when total paid is zero", () => {
    const debts = [{ id: "a", amount: 50 }];
    const result = calculateCoveredDebtIds(debts, 0);
    expect(result.size).toBe(0);
  });

  it("covers a single debt when payment is exact", () => {
    const debts = [{ id: "a", amount: 100 }];
    const result = calculateCoveredDebtIds(debts, 100);
    expect(result).toEqual(new Set(["a"]));
  });

  it("covers a single debt when payment exceeds it", () => {
    const debts = [{ id: "a", amount: 100 }];
    const result = calculateCoveredDebtIds(debts, 150);
    expect(result).toEqual(new Set(["a"]));
  });

  it("does not cover a debt when payment is insufficient", () => {
    const debts = [{ id: "a", amount: 100 }];
    const result = calculateCoveredDebtIds(debts, 99);
    expect(result.size).toBe(0);
  });

  it("allocates greedily from smallest to largest", () => {
    const debts = [
      { id: "big", amount: 300 },
      { id: "small", amount: 100 },
      { id: "mid", amount: 200 },
    ];
    // 100 + 200 = 300, fits; 300 would need 600 total
    const result = calculateCoveredDebtIds(debts, 300);
    expect(result).toEqual(new Set(["small", "mid"]));
  });

  it("covers all debts when payment covers everything", () => {
    const debts = [
      { id: "a", amount: 50 },
      { id: "b", amount: 100 },
      { id: "c", amount: 200 },
    ];
    const result = calculateCoveredDebtIds(debts, 350);
    expect(result).toEqual(new Set(["a", "b", "c"]));
  });

  it("stops at first debt that does not fit (greedy break)", () => {
    const debts = [
      { id: "a", amount: 10 },
      { id: "b", amount: 50 },
      { id: "c", amount: 20 },
    ];
    // sorted: 10, 20, 50 — payment 35 covers 10+20=30, but 50 doesn't fit
    const result = calculateCoveredDebtIds(debts, 35);
    expect(result).toEqual(new Set(["a", "c"]));
  });

  it("does not mutate the original debts array", () => {
    const debts = [
      { id: "b", amount: 200 },
      { id: "a", amount: 100 },
    ];
    const original = [...debts];
    calculateCoveredDebtIds(debts, 500);
    expect(debts).toEqual(original);
  });
});
