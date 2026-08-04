"use client";

import { DateField as AriaDateField, DateInput, DateSegment } from "react-aria-components";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-utils";

const MIN = parseDate(DATE_INPUT_MIN);
const MAX = parseDate(DATE_INPUT_MAX);

function toCalendarDate(value: string | undefined | null): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

interface Props {
  /** Submitted as YYYY-MM-DD, same as the native input it replaced. */
  name?: string;
  /** Controlled value as YYYY-MM-DD ("" for empty). */
  value?: string;
  onChange?: (value: string) => void;
  /** Uncontrolled initial value as YYYY-MM-DD. */
  defaultValue?: string;
  required?: boolean;
  "aria-label"?: string;
  /** Classes for the bordered box, so each call site keeps its own sizing. */
  className?: string;
  /** For the inline-edit cells in transaction-table.tsx. onBlur fires when
   *  focus leaves the whole field, not when it moves between segments. */
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * Date entry in dd/mm/aaaa, always — see `locale-provider.tsx` for why the
 * native `<input type="date">` couldn't be made to do this.
 *
 * Deliberately a plain field with no calendar popover: a floating layer here
 * would have to coexist with `useDismiss` and `useInlineEditGuard` in the
 * forms and dialogs these fields live in. The tradeoff is losing the native
 * picker, including on mobile.
 */
export function DateField({
  name,
  value,
  onChange,
  defaultValue,
  required,
  className,
  autoFocus,
  onBlur,
  onKeyDown,
  ...props
}: Props) {
  const controlled = value !== undefined;

  return (
    <AriaDateField
      name={name}
      isRequired={required}
      minValue={MIN}
      maxValue={MAX}
      autoFocus={autoFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      aria-label={props["aria-label"] ?? "Data"}
      {...(controlled
        ? { value: toCalendarDate(value), onChange: (v: CalendarDate | null) => onChange?.(v ? v.toString() : "") }
        : { defaultValue: toCalendarDate(defaultValue) })}
    >
      <DateInput className={className}>
        {(segment) => (
          <DateSegment
            segment={segment}
            className="px-0.5 tabular-nums outline-none rounded-none data-[placeholder]:text-zinc-400 dark:data-[placeholder]:text-zinc-600 data-[focused]:bg-zinc-900 data-[focused]:text-white dark:data-[focused]:bg-white dark:data-[focused]:text-zinc-900"
          />
        )}
      </DateInput>
    </AriaDateField>
  );
}
