import { formatCurrency } from "@/lib/format-utils";

interface Props {
  totalOwed: number;
  totalPaid: number;
  /** Tailwind size class for the owed value — the admin header runs one step
   *  larger than the public one. */
  size?: string;
}

// Shared by the person detail header and the public view so the two can't
// drift. Both rows are always rendered: the labels make "R$ 0,00" read as a
// settled balance rather than missing data.
export function BalanceSummary({ totalOwed, totalPaid, size = "text-lg" }: Props) {
  return (
    <div className="shrink-0 flex flex-col items-end gap-0.5">
      <p className="flex items-baseline justify-end gap-2">
        <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">
          Valor devido
        </span>
        <span className={`${size} tracking-tight text-zinc-900 dark:text-white`}>
          R$ {formatCurrency(totalOwed)}
        </span>
      </p>
      <p className="flex items-baseline justify-end gap-2">
        <span className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">
          Valor pago
        </span>
        <span className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400">
          R$ {formatCurrency(totalPaid)}
        </span>
      </p>
    </div>
  );
}
