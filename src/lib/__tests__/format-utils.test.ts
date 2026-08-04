import { describe, it, expect } from "vitest";
import { formatCurrency, parseAmountInput, amountSearchTexts, paidPercent } from "@/lib/format-utils";

describe("formatCurrency", () => {
  it("formats with two decimal places, pt-BR style", () => {
    expect(formatCurrency(100)).toBe("100,00");
    expect(formatCurrency(99.999)).toBe("100,00");
    expect(formatCurrency(685.91)).toBe("685,91");
  });

  it("groups thousands with a dot", () => {
    expect(formatCurrency(1234.5)).toBe("1.234,50");
    expect(formatCurrency(1234567.89)).toBe("1.234.567,89");
  });
});

// Typing "685,91" used to make z.coerce.number() produce NaN, which threw
// inside the Server Action and left the form sitting there with no message —
// the "Salvar não faz nada" bug. Both separators must parse.
describe("parseAmountInput", () => {
  it("accepts a pt-BR comma decimal", () => {
    expect(parseAmountInput("685,91")).toBe(685.91);
  });

  it("accepts a plain dot decimal", () => {
    expect(parseAmountInput("685.91")).toBe(685.91);
  });

  it("treats dots as thousands separators when a comma is present", () => {
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1.234.567,89")).toBe(1234567.89);
  });

  it("strips currency symbols and spaces", () => {
    expect(parseAmountInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseAmountInput(" 42 ")).toBe(42);
  });

  it("round-trips what formatCurrency renders", () => {
    for (const n of [0.01, 68.59, 685.91, 1234.5, 1234567.89]) {
      expect(parseAmountInput(formatCurrency(n))).toBe(n);
    }
  });

  it("returns NaN for empty or non-numeric input", () => {
    expect(parseAmountInput("")).toBeNaN();
    expect(parseAmountInput("   ")).toBeNaN();
    expect(parseAmountInput("abc")).toBeNaN();
    expect(parseAmountInput("1,2,3")).toBeNaN();
  });
});

describe("amountSearchTexts", () => {
  it("offers both written forms so either separator matches", () => {
    expect(amountSearchTexts(1234.5)).toEqual(["1.234,50", "1234.50"]);
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
