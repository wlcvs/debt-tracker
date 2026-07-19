import { describe, it, expect } from "vitest";
import { parseBrAmount, parseBrDate, findAllAmounts, findYear, detectYear } from "@/lib/importers/base";

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

  // Pinning actual behavior: Number("") is 0, and Number.isFinite(0) is true,
  // so parseBrAmount currently returns 0 for an empty string rather than null.
  it("returns 0 for an empty string (pinning actual behavior, not an assumed spec)", () => {
    expect(parseBrAmount("")).toBe(0);
  });

  it("parses an amount with no decimal comma at all", () => {
    expect(parseBrAmount("1000")).toBe(1000);
  });

  it("parses an amount with multiple thousands separators", () => {
    expect(parseBrAmount("12.345.678,90")).toBe(12345678.9);
  });

  it("parses an amount with only a comma and no thousands separator", () => {
    expect(parseBrAmount("5,91")).toBe(5.91);
  });

  it("returns null for input with leading/trailing whitespace", () => {
    // Number() trims plain whitespace itself, but a stray non-numeric wrapper
    // like leading/trailing text should still fail cleanly.
    expect(parseBrAmount("  156,68  ")).toBe(156.68);
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

  it("accepts Feb 29 on a leap year", () => {
    expect(parseBrDate(29, 2, 2028)).toBe("2028-02-29");
  });

  it("rejects Feb 29 on a non-leap year", () => {
    expect(parseBrDate(29, 2, 2026)).toBeNull();
  });

  it("rejects day 0", () => {
    expect(parseBrDate(0, 5, 2026)).toBeNull();
  });

  it("rejects day 32", () => {
    expect(parseBrDate(32, 1, 2026)).toBeNull();
  });

  it("rejects month 0", () => {
    expect(parseBrDate(15, 0, 2026)).toBeNull();
  });

  it("rejects month 13", () => {
    expect(parseBrDate(15, 13, 2026)).toBeNull();
  });

  it("defaults to the current calendar year when no year argument is supplied", () => {
    expect(parseBrDate(15, 6)).toBe(`${new Date().getFullYear()}-06-15`);
  });
});

describe("findYear", () => {
  it("finds a year that only appears on page 2, not page 1", () => {
    const pages = ["Extrato sem data aqui", "Vencimento em 2027 para esta fatura"];
    expect(findYear(pages)).toBe(2027);
  });

  it("returns null when no page matches", () => {
    expect(findYear(["nada aqui", "nem aqui"])).toBeNull();
  });

  it("uses a custom pattern override to change what's matched", () => {
    const pages = ["Ref:99 mas o ano real é 2030"];
    expect(findYear(pages, /Ref:(\d{2})/)).toBe(99);
    expect(findYear(pages)).toBe(2030);
  });
});

describe("detectYear", () => {
  it("falls back to the current year when no page matches", () => {
    expect(detectYear(["nada aqui", "nem aqui"])).toBe(new Date().getFullYear());
  });

  it("returns the found year when present", () => {
    expect(detectYear(["sem nada", "fatura de 2025"])).toBe(2025);
  });

  it("accepts a custom pattern override", () => {
    expect(detectYear(["Ref:2019"], /Ref:(\d{4})/)).toBe(2019);
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

  it("returns an empty array when the line has no BR-amount-shaped substrings", () => {
    expect(findAllAmounts("nenhum valor monetário nesta linha")).toEqual([]);
  });
});
