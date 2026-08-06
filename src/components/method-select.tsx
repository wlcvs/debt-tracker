"use client";

import * as Select from "@radix-ui/react-select";

export interface MethodOption {
  value: string;
  label: string;
}

interface Props {
  name: string;
  options: MethodOption[];
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  /** Accessible name for the trigger; see the aria-label comment below. */
  label?: string;
}

export function MethodSelect({ name, options, value, onChange, error, placeholder = "— Método —", label = "Método" }: Props) {
  // Select.Root takes `value` straight, never `value || undefined`: passing undefined
  // makes Radix fall back to uncontrolled and keep its own last selection, so clearing
  // this back to "" while the component stays mounted would leave Radix still holding
  // the old method — re-picking it then changes nothing from its point of view and
  // onValueChange never fires, stranding the caller on "". Radix already treats "" as
  // "show the placeholder", so the fallback bought nothing. Only reachable where a form
  // resets without unmounting, which is what NewEntryModal does after every save.
  return (
    <Select.Root value={value} onValueChange={onChange}>
      {/* Kept instead of Select.Root's own `name` prop, which would render a
          hidden native <select>. That select only emits a synthetic empty
          <option> when the value is `undefined`; this component's "no method
          chosen" state is "", and a native select whose value matches no option
          falls back to selecting its *first* one — so formData.get("debtMethod")
          would come back "PIX" instead of "". Every server action reads this
          field, and the detail modals' edit round-trip depends on "" staying "".
          method-select.test.tsx locks that contract. */}
      <input type="hidden" name={name} value={value} />

      <Select.Trigger
        // role="combobox" does not take its name from content the way a button
        // does, and the visible "Método" caption each consumer renders above this
        // control was never associated with it. Without this the trigger reaches
        // screen readers unnamed.
        aria-label={label}
        className={`w-full text-left flex justify-between items-center bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest focus:outline-none transition-colors cursor-pointer ${
          value ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
        }`}
      >
        <Select.Value placeholder={placeholder} />
        {/* Plain text, not Select.Icon: "▾" is a character, and the app's design
            rules forbid icons outright. ItemIndicator and the scroll buttons are
            optional too and are deliberately omitted for the same reason —
            selection stays expressed by text colour. */}
        <span className="text-[10px] text-zinc-400 ml-2">▾</span>
      </Select.Trigger>

      {error && <p className="text-xs text-red-500 mt-1 tracking-wide">Campo obrigatório</p>}

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={1}
          className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
          style={{ width: "var(--radix-select-trigger-width)" }}
        >
          <Select.Viewport className="max-h-40 overflow-y-auto">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={`w-full text-left px-3 py-2 text-xs tracking-widest cursor-pointer outline-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800 transition-colors ${
                  opt.value === value ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
