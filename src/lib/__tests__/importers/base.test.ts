import { describe, it, expect } from "vitest";
import { parseBrAmount, parseBrDate, findAllAmounts } from "@/lib/importers/base";

describe("parseBrAmount", () => {
  it("parses a simple BR amount", () => {
    expect(parseBrAmount("156,68")).toBe(156.68);
  });

  it("parses an amount with a thousands separator", () => {
    expect(parseBrAmount("1.234,56")).toBe(1234.56);
  });

  it("returns null for garbage input", () => {
    expect(parseBrAmount("not a number")).toBeNull();
  });
});

describe("parseBrDate", () => {
  it("builds an ISO date from day/month/year", () => {
    expect(parseBrDate(27, 3, 2026)).toBe("2026-03-27");
  });

  it("expands a 2-digit year", () => {
    expect(parseBrDate(1, 5, 26)).toBe("2026-05-01");
  });

  it("returns null for an invalid date", () => {
    expect(parseBrDate(31, 2, 2026)).toBeNull();
  });
});

describe("findAllAmounts", () => {
  it("finds every BR amount in a string", () => {
    expect(findAllAmounts("27/03 DISTRIBUIDOR-CT EI03/03 156,68IOF de financiamento 5,91")).toEqual([
      "156,68",
      "5,91",
    ]);
  });

  it("is safe to call repeatedly without leaking regex state", () => {
    const text = "10,00 20,00";
    expect(findAllAmounts(text)).toEqual(["10,00", "20,00"]);
    expect(findAllAmounts(text)).toEqual(["10,00", "20,00"]);
  });
});
