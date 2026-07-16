import { describe, it, expect } from "vitest";
import { getMonthKey, formatMonthLabel, addMonthsClamped, getAvailableMonths } from "@/lib/date-utils";

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
});
