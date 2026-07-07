"use client";

import { lineText, type PdfLine, type PdfTextItem } from "@/lib/pdf/group-lines";
import { getLoadedPdfjs, type PageInfo } from "@/lib/pdf-viewer-controller";

export function brAmount(value: number | string): string {
  return Math.abs(parseFloat(String(value))).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface HighlightMatch {
  pageIdx: number;
  lineIdx: number;
  key: string;
  hasDate: boolean;
}

// Finds every line on any page whose text contains the transaction's
// formatted amount — same matching used to draw the permanent highlighter
// marks and to jump to a clicked row.
export function findMatches(t: { amount: number | string; date: string }, pageInfos: PageInfo[]): HighlightMatch[] {
  const needle = brAmount(t.amount);
  const dayNeedle = (t.date || "").slice(8, 10);
  const matches: HighlightMatch[] = [];

  pageInfos.forEach((info, pageIdx) => {
    info.lines.forEach((line, lineIdx) => {
      const merged = lineText(line);
      if (merged.includes(needle)) {
        matches.push({
          pageIdx,
          lineIdx,
          key: `${pageIdx}:${lineIdx}`,
          hasDate: !!dayNeedle && merged.includes(dayNeedle),
        });
      }
    });
  });

  return matches;
}

// The same amount can appear on more than one line — track which lines are
// already highlighted so each line is claimed by at most one transaction;
// otherwise two overlapping marks stack into a single, more opaque block
// that looks like a rendering glitch. Prefer a line that also contains the
// transaction's day as a soft tiebreaker, since date formats vary too much
// across banks to use as a primary key.
export function pickBestMatch(matches: HighlightMatch[], claimedLineKeys: Set<string>): HighlightMatch | null {
  if (!matches.length) return null;
  const unclaimed = matches.filter((m) => !claimedLineKeys.has(m.key));
  const pool = unclaimed.length ? unclaimed : matches;
  const best = pool.find((m) => m.hasDate) || pool[0];
  claimedLineKeys.add(best.key);
  return best;
}

// Some statements lay out one transaction as a right-aligned numbers row
// vertically centered against a two-line left cell — offset by a few points
// on each side, past groupLines's clustering tolerance, so they land in
// their own line buckets despite belonging to the same visual row. Pull in
// one line above and below when the gap between them is small relative to
// the text's own font size, so the highlight box covers the row's full
// content instead of just the numbers column.
export function expandRowBand(lines: PdfLine[], lineIdx: number): PdfTextItem[] {
  const items = [...lines[lineIdx].items];
  const heights = lines[lineIdx].items.map((i) => Math.abs(i.transform[3]) || 0);
  const fontHeight = heights.length ? Math.max(...heights) : 10;
  const gapLimit = fontHeight * 0.75;

  if (lineIdx > 0 && lines[lineIdx - 1].y - lines[lineIdx].y <= gapLimit) {
    items.push(...lines[lineIdx - 1].items);
  }
  if (lineIdx < lines.length - 1 && lines[lineIdx].y - lines[lineIdx + 1].y <= gapLimit) {
    items.push(...lines[lineIdx + 1].items);
  }

  return items;
}

export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Builds a rect spanning the matched row's own content — from the leftmost
// to the rightmost text run on the row (expanded via expandRowBand to
// include any same-row sub-lines), not the full page width — with a little
// vertical breathing room so it reads as a mark over the row rather than a
// thin underline. Geometry only; rendering is the caller's job (a portaled
// JSX element, not imperative DOM creation, is the one deliberate deviation
// from the original Alpine implementation this was ported from).
export function buildHighlightRect(m: HighlightMatch, pageInfos: PageInfo[]): HighlightRect {
  const pdfjsLib = getLoadedPdfjs();
  if (!pdfjsLib) throw new Error("pdf.js not loaded yet");

  const info = pageInfos[m.pageIdx];
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;

  expandRowBand(info.lines, m.lineIdx).forEach((item) => {
    const tx = pdfjsLib.Util.transform(info.fitViewport.transform, item.transform);
    const height = Math.hypot(tx[2], tx[3]) || 10;
    const itemWidth = (item.width || 0) * info.fitViewport.scale;
    top = Math.min(top, tx[5] - height);
    bottom = Math.max(bottom, tx[5]);
    left = Math.min(left, tx[4]);
    right = Math.max(right, tx[4] + itemWidth);
  });

  const pad = (bottom - top) * 0.3;
  return { left, top: top - pad, width: right - left, height: bottom - top + pad * 2 };
}
