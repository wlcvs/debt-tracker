"use client";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled }: Props) {
  return (
    <label
      className={`flex items-center gap-2 text-xs tracking-widest uppercase transition-colors ${
        disabled ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed" : "text-zinc-500 dark:text-zinc-400 cursor-pointer"
      }`}
    >
      <span
        className={`relative shrink-0 w-4 h-4 border flex items-center justify-center transition-colors ${
          disabled
            ? "border-zinc-200 dark:border-zinc-800"
            : checked
              ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white"
              : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        {checked && <span className="w-2 h-2 bg-white dark:bg-zinc-900" />}
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </span>
      {label}
    </label>
  );
}
