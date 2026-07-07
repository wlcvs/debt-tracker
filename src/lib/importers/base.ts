export const MONTHS_PT: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

const AMOUNT_PATTERN = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2})`;
// Non-global: safe to reuse with .match()/.test() without lastIndex state leaking
// between calls. Use findAllAmounts() below for the findall-equivalent case.
export const AMOUNT_RE = new RegExp(AMOUNT_PATTERN);
export const DATE_SLASH_RE = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;
export const DATE_PT_RE = /\b(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/i;

export function findAllAmounts(text: string): string[] {
  return [...text.matchAll(new RegExp(AMOUNT_PATTERN, "g"))].map((m) => m[1]);
}

export interface Transaction {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
}

export function parseBrAmount(s: string): number | null {
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseBrDate(day: number, month: number, year?: number): string | null {
  let y = year ?? new Date().getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

export { extractPages, extractTextPages, type PdfPage } from "@/lib/importers/pdf-text";
