import { describe, it, expect } from "vitest";
import { groupLines, lineText, type PdfTextItem } from "@/lib/pdf/group-lines";

function item(str: string, x: number, y: number, width: number): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}

describe("groupLines", () => {
  it("groups items on the same baseline into one line, sorted left to right", () => {
    const items = [item("World", 50, 100, 30), item("Hello", 0, 100, 30)];
    const lines = groupLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].items.map((i) => i.str)).toEqual(["Hello", "World"]);
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
});
