// One shared formatter instance — building an Intl.NumberFormat per call is
// the expensive part, and every list row renders several amounts.
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display format for every amount in the app: 1234.5 -> "1.234,50". */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * The inverse of formatCurrency, and the only place a typed amount becomes a
 * number. Accepts what the UI shows back ("1.234,56"), what a pt-BR keyboard
 * produces ("685,91") and what a plain number input produces ("685.91").
 * Returns NaN for anything else, so Zod rejects it instead of coercing.
 *
 * A comma is what disambiguates the two separators: with one, dots are
 * thousands separators; without one, a dot is the decimal point. That leaves
 * bare "1.234" ambiguous — it reads as 1.234, not 1234 — which is acceptable
 * because every amount the app displays or prefills carries the comma.
 */
export function parseAmountInput(input: string): number {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (cleaned === "") return NaN;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  return Number(normalized);
}

/**
 * Both written forms of an amount, for the list search boxes: the pt-BR one
 * the row actually displays ("1.234,56") and the plain one ("1234.56"), so
 * searching either separator finds the row. Spread into getSearchText.
 */
export function amountSearchTexts(amount: number): string[] {
  return [formatCurrency(amount), amount.toFixed(2)];
}
