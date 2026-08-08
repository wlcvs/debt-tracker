import { formatCurrency } from "@/lib/format-utils";

interface Props {
  totalOwed: number;
  totalPaid: number;
  /** Tailwind size class for both values — the admin page runs one step
   *  larger than the public one. */
  size?: string;
}

const labelClass = "text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500";
const valueClass = "tracking-tight text-right text-zinc-900 dark:text-white";

// Shared by the person page and the public view so the two can't drift. Both
// rows are always rendered: the labels make "R$ 0,00" read as a settled balance
// rather than missing data, and the label is now the *only* thing separating
// the two figures — they share a size and a color.
//
// A two-column grid rather than two independently right-aligned rows. With the
// old layout each row hugged the right edge on its own, so the moment the two
// amounts had different widths ("R$ 1.234,50" over "R$ 20,00") the labels went
// ragged on both sides and the amounts stopped sharing a left edge. Here the
// label column pins the labels' left edges and the value column pins the
// amounts' right edges, whatever the values are.
//
// No tabular-nums: the app's base font is already monospaced (globals.css).
export function BalanceSummary({ totalOwed, totalPaid, size = "text-lg" }: Props) {
  return (
    <div className="shrink-0 grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5">
      <span className={labelClass}>Valor devido</span>
      <span className={`${size} ${valueClass}`}>R$ {formatCurrency(totalOwed)}</span>
      <span className={labelClass}>Valor pago</span>
      <span className={`${size} ${valueClass}`}>R$ {formatCurrency(totalPaid)}</span>
    </div>
  );
}
