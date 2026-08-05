"use client";

import { useId } from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Radix checkbox in the app's HUD styling: a square that fills in, with a smaller
 * inverted square as the indicator — deliberately not a checkmark glyph, since the
 * design rules forbid icons.
 *
 * This used to be a hand-rolled `opacity-0` native input stretched over a drawn
 * <span>, which had no role/aria-checked of its own and no focus styling. The props
 * API is unchanged so call sites didn't have to move.
 *
 * Root renders a <button type="button">, so it stays inert inside the forms these
 * live in. Passing no `name` keeps Radix's hidden form-bubbling input out of the
 * FormData too: every consumer reads this component's state through React, never
 * through formData.get().
 */
export function Checkbox({ checked, onChange, label, disabled }: Props) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
        disabled={disabled}
        className="shrink-0 w-4 h-4 border flex items-center justify-center transition-colors cursor-pointer border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900 dark:data-[state=checked]:bg-white dark:data-[state=checked]:border-white focus-visible:outline-none focus-visible:border-zinc-500 dark:focus-visible:border-zinc-400 disabled:cursor-not-allowed disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:data-[state=checked]:bg-zinc-200 dark:disabled:data-[state=checked]:bg-zinc-800"
      >
        <RadixCheckbox.Indicator className="block w-2 h-2 bg-white dark:bg-zinc-900" />
      </RadixCheckbox.Root>
      {label && (
        <label
          htmlFor={id}
          className={`text-xs tracking-widest uppercase transition-colors ${
            disabled
              ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
              : "text-zinc-500 dark:text-zinc-400 cursor-pointer"
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
}
