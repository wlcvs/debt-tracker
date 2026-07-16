// Dates in this app come from date-only strings (`z.coerce.date()` on "YYYY-MM-DD" input),
// which JS always parses as UTC midnight — so calendar-date math here operates on UTC
// components to match, avoiding a day shift in timezones west of UTC.

export function getMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
  return label.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function addMonthsClamped(date: Date, n: number): Date {
  const day = date.getUTCDate();
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
  const daysInTargetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, daysInTargetMonth));
  base.setUTCHours(date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
  return base;
}

export function formatDateBR(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export function getAvailableMonths(dates: Date[], alwaysInclude?: Date): string[] {
  const keys = new Set(dates.map(getMonthKey));
  if (alwaysInclude) keys.add(getMonthKey(alwaysInclude));
  return Array.from(keys).sort();
}
