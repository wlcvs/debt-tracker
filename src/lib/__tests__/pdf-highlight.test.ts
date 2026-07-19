import { describe, it, expect, vi } from "vitest";
import { groupLines, type PdfTextItem } from "@/lib/pdf/group-lines";
import type { PageInfo } from "@/lib/pdf-viewer-controller";

vi.mock("@/lib/pdf-viewer-controller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf-viewer-controller")>(
    "@/lib/pdf-viewer-controller"
  );
  return {
    ...actual,
    getLoadedPdfjs: vi.fn(() => ({
      // Identity-ish transform: just returns the item's own matrix, which is
      // enough to exercise the geometry math in buildHighlightRect.
      Util: { transform: (_viewportTransform: number[], itemTransform: number[]) => itemTransform },
    })),
  };
});

const { brAmount, findMatches, pickBestMatch, expandRowBand, buildHighlightRect } = await import(
  "@/lib/pdf-highlight"
);

function item(str: string, x: number, y: number, width: number, height = 10): PdfTextItem {
  return { str, transform: [1, 0, 0, height, x, y], width };
}

function makePageInfo(itemsByLine: PdfTextItem[][]): PageInfo {
  const flat = itemsByLine.flat();
  return {
    // No jsdom in this test environment; findMatches/buildHighlightRect never
    // touch the element itself, so a plain stand-in is enough.
    wrapperEl: {} as HTMLDivElement,
    baseWidth: 700,
    baseHeight: 900,
    lines: groupLines(flat),
    fitViewport: { transform: [1, 0, 0, 1, 0, 0], scale: 1 } as unknown as PageInfo["fitViewport"],
  };
}

describe("brAmount", () => {
  it("formats a number as BR currency digits", () => {
    expect(brAmount(156.68)).toBe("156,68");
    expect(brAmount("1234.5")).toBe("1.234,50");
    expect(brAmount(-42)).toBe("42,00");
  });
});

describe("findMatches", () => {
  it("finds lines containing the transaction's formatted amount", () => {
    const pageInfos = [makePageInfo([[item("Compra 156,68", 0, 100, 60)], [item("Outra 10,00", 0, 80, 50)]])];
    const matches = findMatches({ amount: 156.68, date: "2026-03-27" }, pageInfos);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ pageIdx: 0 });
  });

  it("flags a match that also contains the transaction's day", () => {
    const pageInfos = [makePageInfo([[item("27/03 156,68", 0, 100, 60)]])];
    const matches = findMatches({ amount: 156.68, date: "2026-03-27" }, pageInfos);
    expect(matches[0].hasDate).toBe(true);
  });

  it("returns no matches when there are no pages at all", () => {
    const matches = findMatches({ amount: 156.68, date: "2026-03-27" }, []);
    expect(matches).toEqual([]);
  });

  it("returns no matches when the amount never appears on any page", () => {
    const pageInfos = [makePageInfo([[item("Compra 10,00", 0, 100, 60)]])];
    const matches = findMatches({ amount: 999.99, date: "2026-03-27" }, pageInfos);
    expect(matches).toEqual([]);
  });

  it("finds every occurrence of the amount across multiple pages", () => {
    const pageInfos = [
      makePageInfo([[item("Compra 156,68", 0, 100, 60)]]),
      makePageInfo([[item("Estorno 156,68", 0, 100, 60)]]),
    ];
    const matches = findMatches({ amount: 156.68, date: "2026-03-27" }, pageInfos);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.pageIdx)).toEqual([0, 1]);
  });

  it("matches an amount even when the line contains R$ and parentheses", () => {
    const pageInfos = [makePageInfo([[item("Compra (loja) R$ 156,68", 0, 100, 60)]])];
    const matches = findMatches({ amount: 156.68, date: "2026-03-27" }, pageInfos);
    expect(matches).toHaveLength(1);
  });

  it("never sets hasDate when the transaction has no date", () => {
    const pageInfos = [makePageInfo([[item("27/03 156,68", 0, 100, 60)]])];
    const matches = findMatches({ amount: 156.68, date: "" }, pageInfos);
    expect(matches[0].hasDate).toBe(false);
  });
});

describe("pickBestMatch", () => {
  it("returns null for an empty match list", () => {
    expect(pickBestMatch([], new Set())).toBeNull();
  });

  it("prefers an unclaimed match over a claimed one", () => {
    const claimed = new Set(["0:0"]);
    const best = pickBestMatch(
      [
        { pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false },
        { pageIdx: 0, lineIdx: 1, key: "0:1", hasDate: false },
      ],
      claimed
    );
    expect(best?.key).toBe("0:1");
  });

  it("claims the line so a second lookup doesn't reuse it", () => {
    const claimed = new Set<string>();
    const matches = [{ pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false }];
    const first = pickBestMatch(matches, claimed);
    const second = pickBestMatch(matches, claimed);
    expect(first?.key).toBe("0:0");
    expect(second?.key).toBe("0:0"); // falls back to the same match since nothing else exists
    expect(claimed.has("0:0")).toBe(true);
  });

  it("prefers a match with the transaction's date as a tiebreaker", () => {
    const best = pickBestMatch(
      [
        { pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false },
        { pageIdx: 0, lineIdx: 1, key: "0:1", hasDate: true },
      ],
      new Set()
    );
    expect(best?.key).toBe("0:1");
  });

  it("breaks a tie between multiple hasDate matches by taking the first one", () => {
    const best = pickBestMatch(
      [
        { pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false },
        { pageIdx: 0, lineIdx: 1, key: "0:1", hasDate: true },
        { pageIdx: 0, lineIdx: 2, key: "0:2", hasDate: true },
      ],
      new Set()
    );
    expect(best?.key).toBe("0:1");
  });

  it("falls back to the full (already-claimed) pool when every match is claimed", () => {
    const claimed = new Set(["0:0", "0:1"]);
    const best = pickBestMatch(
      [
        { pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false },
        { pageIdx: 0, lineIdx: 1, key: "0:1", hasDate: true },
      ],
      claimed
    );
    expect(best?.key).toBe("0:1"); // still prefers hasDate even among claimed lines
  });
});

describe("expandRowBand", () => {
  it("pulls in an adjacent line within the font-height gap threshold", () => {
    const lines = groupLines([item("PIX ENVIADO", 0, 100, 60, 10), item("DES: nota", 0, 95, 60, 10)]);
    const idx = lines.findIndex((l) => l.items[0].str === "PIX ENVIADO");
    const items = expandRowBand(lines, idx);
    expect(items.map((i) => i.str)).toEqual(expect.arrayContaining(["PIX ENVIADO", "DES: nota"]));
  });

  it("does not pull in a line far beyond the gap threshold", () => {
    const lines = groupLines([item("Row A", 0, 100, 40, 10), item("Row B", 0, 50, 40, 10)]);
    const idx = lines.findIndex((l) => l.items[0].str === "Row A");
    const items = expandRowBand(lines, idx);
    expect(items.map((i) => i.str)).toEqual(["Row A"]);
  });

  it("does not look above the first line (no out-of-bounds access)", () => {
    const lines = groupLines([
      item("Row A", 0, 100, 40, 10),
      item("Row B", 0, 50, 40, 10),
      item("Row C", 0, 0, 40, 10),
    ]);
    const items = expandRowBand(lines, 0);
    expect(items.map((i) => i.str)).toEqual(["Row A"]);
  });

  it("does not look below the last line (no out-of-bounds access)", () => {
    const lines = groupLines([
      item("Row A", 0, 100, 40, 10),
      item("Row B", 0, 50, 40, 10),
      item("Row C", 0, 0, 40, 10),
    ]);
    const items = expandRowBand(lines, lines.length - 1);
    expect(items.map((i) => i.str)).toEqual(["Row C"]);
  });
});

describe("buildHighlightRect", () => {
  it("computes a bounding rect around the matched row's content", () => {
    const pageInfos = [makePageInfo([[item("Compra 156,68", 0, 100, 60, 10)]])];
    const rect = buildHighlightRect({ pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false }, pageInfos);
    expect(rect.left).toBe(0);
    expect(rect.width).toBe(60);
    expect(rect.height).toBeGreaterThan(10); // includes vertical padding
  });

  it("spans left-to-right across multiple items on the same row", () => {
    const pageInfos = [makePageInfo([[item("Compra", 0, 100, 20, 10), item("156,68", 30, 100, 25, 10)]])];
    const rect = buildHighlightRect({ pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false }, pageInfos);
    expect(rect.left).toBe(0);
    expect(rect.width).toBe(55); // rightmost item's x (30) + its width (25)
  });

  it("produces a zero-width rect for a single zero-width item", () => {
    const pageInfos = [makePageInfo([[item("", 10, 100, 0, 10)]])];
    const rect = buildHighlightRect({ pageIdx: 0, lineIdx: 0, key: "0:0", hasDate: false }, pageInfos);
    expect(rect.left).toBe(10);
    expect(rect.width).toBe(0);
  });
});
