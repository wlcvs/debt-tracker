"use client";

import { formatMonthLabel } from "@/lib/date-utils";

interface Props {
  months: string[];
  selected: string;
  onSelect: (month: string) => void;
}

export function MonthCarousel({ months, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {months.map((month) => {
        const isSelected = month === selected;
        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelect(month)}
            className={`shrink-0 border px-4 py-2 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
              isSelected
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400"
            }`}
          >
            {formatMonthLabel(month)}
          </button>
        );
      })}
    </div>
  );
}
