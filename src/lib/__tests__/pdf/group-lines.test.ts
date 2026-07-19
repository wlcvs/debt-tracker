import { describe, it, expect } from "vitest";
import { groupLines, lineText, type PdfTextItem } from "@/lib/pdf/group-lines";

function item(str: string, x: number, y: number, width: number): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}

describe("groupLines", () => {
  it("returns an empty array for an empty input", () => {
    expect(groupLines([])).toEqual([]);
  });

  it("returns a single line for a single item", () => {
    const lines = groupLines([item("Solo", 0, 100, 20)]);
    expect(lines).toHaveLength(1);
    expect(lines[0].items).toHaveLength(1);
    expect(lines[0].items[0].str).toBe("Solo");
  });

  it("groups items on the same baseline into one line, sorted left to right", () => {
    const items = [item("World", 50, 100, 30), item("Hello", 0, 100, 30)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].items.map((i) => i.str)).toEqual(["Hello", "World"]);
  });

  it("merges a y-difference exactly at the tolerance boundary (2) into the same line", () => {
    const items = [item("A", 0, 100, 10), item("B", 20, 98, 10)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(1);
  });

  it("splits a y-difference just beyond the tolerance boundary into separate lines", () => {
    const items = [item("A", 0, 100, 10), item("B", 20, 97.9, 10)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(2);
  });

  it("sorts three out-of-x-order items within the same row before concatenation", () => {
    const items = [item("Third", 100, 100, 10), item("First", 0, 100, 10), item("Second", 50, 100, 10)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].items.map((i) => i.str)).toEqual(["First", "Second", "Third"]);
  });

  it("keeps several distinct rows separate and ordered top-to-bottom", () => {
    const items = [item("Row two", 0, 50, 40), item("Row one", 0, 100, 40), item("Row three", 0, 0, 40)];
    const lines = groupLines(items);
    expect(lines.map((l) => l.items[0].str)).toEqual(["Row one", "Row two", "Row three"]);
  });

  it("keeps small sub-pixel y differences (< tolerance) on the same line", () => {
    // Columns in the same visual row can differ by fractions of a point
    const items = [item("10/03", 0, 100.4, 30), item("156,68", 100, 100, 30)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(1);
  });

  it("splits genuinely different rows into separate lines", () => {
    const items = [item("Row one", 0, 100, 40), item("Row two", 0, 80, 40)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(2);
    // sorted top-to-bottom (descending y)
    expect(lines[0].items[0].str).toBe("Row one");
    expect(lines[1].items[0].str).toBe("Row two");
  });
});

describe("lineText", () => {
  it("joins adjacent runs with no gap directly (kerning-split words)", () => {
    const line = groupLines([item("Hel", 0, 100, 10), item("lo", 10, 100, 8)])[0];
    expect(lineText(line)).toBe("Hello");
  });

  it("inserts a space across a real column gap", () => {
    const line = groupLines([item("Descrição", 0, 100, 40), item("156,68", 200, 100, 30)])[0];
    expect(lineText(line)).toBe("Descrição 156,68");
  });

  it("returns an empty string for a line with no items", () => {
    expect(lineText({ y: 0, items: [] })).toBe("");
  });

  it("does not insert a space at a gap exactly at the threshold (1)", () => {
    const line = groupLines([item("AAA", 0, 100, 10), item("BBB", 11, 100, 10)])[0];
    expect(lineText(line)).toBe("AAABBB");
  });

  it("inserts a space at a gap just beyond the threshold (1)", () => {
    const line = groupLines([item("AAA", 0, 100, 10), item("BBB", 11.01, 100, 10)])[0];
    expect(lineText(line)).toBe("AAA BBB");
  });

  it("treats a missing width as 0 when computing the next gap", () => {
    const noWidthItem: PdfTextItem = { str: "AAA", transform: [1, 0, 0, 1, 0, 100] };
    const line = groupLines([noWidthItem, item("BBB", 2, 100, 10)])[0];
    // prevEndX = 0 + 0 = 0; gap to next item's x (2) is > threshold (1) -> space inserted
    expect(lineText(line)).toBe("AAA BBB");
  });
});
