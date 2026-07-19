import { describe, it, expect } from "vitest";
import { getMonthKey, formatMonthLabel, addMonthsClamped, getAvailableMonths, formatDateBR } from "@/lib/date-utils";

describe("getMonthKey", () => {
  it("formats year and 1-based month, zero-padded", () => {
    expect(getMonthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(getMonthKey(new Date(2026, 10, 1))).toBe("2026-11");
  });
});

describe("formatMonthLabel", () => {
  it("produces a short pt-BR month/year label", () => {
    const label = formatMonthLabel("2026-07");
    expect(label.toLowerCase()).toContain("jul");
    expect(label).toContain("26");
  });

  it("produces the exact expected string for a given month key", () => {
    expect(formatMonthLabel("2026-07")).toBe("Jul de 26");
  });

  it("strips the trailing period from the pt-BR abbreviation (e.g. 'jan.')", () => {
    // Intl.DateTimeFormat("pt-BR", { month: "short" }) renders January as "jan." —
    // formatMonthLabel must strip that period and capitalize the result.
    expect(formatMonthLabel("2026-01")).toBe("Jan de 26");
  });
});

describe("addMonthsClamped", () => {
  it("adds whole months without overflow", () => {
    const result = addMonthsClamped(new Date(2026, 0, 15), 2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });

  it("clamps day-of-month overflow (Jan 31 + 1 month -> Feb 28/29)", () => {
    const result = addMonthsClamped(new Date(2026, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("clamps for leap years correctly", () => {
    const result = addMonthsClamped(new Date(2028, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it("supports negative n to go backwards", () => {
    const result = addMonthsClamped(new Date(2026, 2, 31), -1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("crosses year boundaries", () => {
    const result = addMonthsClamped(new Date(2026, 0, 5), -1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(5);
  });

  it("n=0 returns the same calendar date (identity)", () => {
    const base = new Date(Date.UTC(2026, 5, 10));
    const result = addMonthsClamped(base, 0);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(10);
  });

  it("preserves time-of-day components", () => {
    const base = new Date(Date.UTC(2026, 0, 15, 13, 45, 30, 250));
    const result = addMonthsClamped(base, 2);
    expect(result.getUTCHours()).toBe(13);
    expect(result.getUTCMinutes()).toBe(45);
    expect(result.getUTCSeconds()).toBe(30);
    expect(result.getUTCMilliseconds()).toBe(250);
  });

  it("clamps day 31 into a 30-day month (April)", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 2, 31)), 1);
    expect(result.getUTCMonth()).toBe(3);
    expect(result.getUTCDate()).toBe(30);
  });

  it("clamps day 31 into a 30-day month (June)", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 4, 31)), 1);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(30);
  });

  it("clamps day 31 into a 30-day month (September)", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 7, 31)), 1);
    expect(result.getUTCMonth()).toBe(8);
    expect(result.getUTCDate()).toBe(30);
  });

  it("clamps day 31 into a 30-day month (November)", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 9, 31)), 1);
    expect(result.getUTCMonth()).toBe(10);
    expect(result.getUTCDate()).toBe(30);
  });

  it("handles large positive n spanning multiple years", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 0, 15)), 25);
    expect(result.getUTCFullYear()).toBe(2028);
    expect(result.getUTCMonth()).toBe(1);
    expect(result.getUTCDate()).toBe(15);
  });

  it("handles large negative n spanning multiple years", () => {
    const result = addMonthsClamped(new Date(Date.UTC(2026, 0, 15)), -13);
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(11);
    expect(result.getUTCDate()).toBe(15);
  });
});

describe("formatDateBR", () => {
  it("formats a date as DD/MM/YYYY", () => {
    expect(formatDateBR(new Date(Date.UTC(2026, 6, 19)))).toBe("19/07/2026");
  });

  it("zero-pads single-digit day and month", () => {
    expect(formatDateBR(new Date(Date.UTC(2026, 2, 5)))).toBe("05/03/2026");
  });

  it("formats December 31st correctly", () => {
    expect(formatDateBR(new Date(Date.UTC(2026, 11, 31)))).toBe("31/12/2026");
  });

  it("formats January 1st correctly", () => {
    expect(formatDateBR(new Date(Date.UTC(2026, 0, 1)))).toBe("01/01/2026");
  });
});

describe("getAvailableMonths", () => {
  it("returns unique sorted month keys", () => {
    const dates = [new Date(2026, 5, 1), new Date(2026, 2, 15), new Date(2026, 5, 20)];
    expect(getAvailableMonths(dates)).toEqual(["2026-03", "2026-06"]);
  });

  it("always includes alwaysInclude even with no matching data", () => {
    const dates = [new Date(2026, 2, 1)];
    expect(getAvailableMonths(dates, new Date(2026, 6, 15))).toEqual(["2026-03", "2026-07"]);
  });

  it("returns empty array for no dates and no alwaysInclude", () => {
    expect(getAvailableMonths([])).toEqual([]);
  });

  it("collapses multiple dates within the same month into one key", () => {
    const dates = [new Date(2026, 5, 1), new Date(2026, 5, 15), new Date(2026, 5, 30)];
    expect(getAvailableMonths(dates)).toEqual(["2026-06"]);
  });

  it("does not duplicate a month already present when alwaysInclude matches it", () => {
    const dates = [new Date(2026, 5, 1)];
    expect(getAvailableMonths(dates, new Date(2026, 5, 20))).toEqual(["2026-06"]);
  });

  it("sorts correctly across a year boundary", () => {
    const dates = [new Date(2026, 0, 5), new Date(2025, 11, 20)];
    expect(getAvailableMonths(dates)).toEqual(["2025-12", "2026-01"]);
  });
});
