"use client";

import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { createPerson } from "@/lib/actions/person";

interface PersonOption {
  accessCode: string;
  name: string;
}

interface Props {
  people: PersonOption[];
  value: string;
  onChange: (value: string) => void;
  onPersonCreated: (person: PersonOption) => void;
  placeholder?: string;
  /** Accessible name for the trigger; see the aria-label comment below. */
  label?: string;
  /**
   * "sm" (default) is sized for a transaction-table cell. "md" matches the plain
   * text inputs and MethodSelect, for use as a normal field in a form — at "sm"
   * it reads as a stray table control next to them.
   */
  size?: "sm" | "md";
}

const TRIGGER_SIZE = {
  sm: "bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 px-1 py-0.5 text-[10px] tracking-wider",
  md: "bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest",
} as const;

const OPTION_SIZE = {
  sm: "px-2 py-1 text-[10px] tracking-wider",
  md: "px-3 py-2 text-xs tracking-wider",
} as const;

export function PersonSelect({
  people,
  value,
  onChange,
  onPersonCreated,
  placeholder = "—",
  label = "Devedor",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !formRef.current) return;
    const focusables = formRef.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function cancelCreating() {
    setCreating(false);
    setNewName("");
    setError("");
  }

  function closePopover() {
    setOpen(false);
    cancelCreating();
  }

  async function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Informe o nome do devedor.");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("name", trimmed);
    const person = await createPerson(fd);
    setSaving(false);
    onPersonCreated(person);
    onChange(person.accessCode);
    closePopover();
  }

  const selected = people.find((p) => p.accessCode === value);

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : closePopover())}>
      <Popover.Trigger asChild>
        <button
          type="button"
          // Otherwise this button's name is whatever it currently shows — the
          // selected person plus the "▾" — so it has no stable identity, and the
          // "Devedor" caption rendered above it was never associated with it.
          // Same treatment as MethodSelect's trigger.
          aria-label={label}
          className={`w-full text-left flex justify-between items-center border focus:outline-none transition-colors cursor-pointer ${TRIGGER_SIZE[size]} ${
            selected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <span className="text-[9px] text-zinc-400 ml-1 shrink-0">▾</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Rendered via portal to document.body (Radix), positioned by Floating UI relative
            to the trigger — this table cell's own dropdown used to be a plain absolutely-
            positioned child instead, which only spans the Devedor column's width but is
            taller than one row, so it visually overlapped several rows below it and even
            intercepted clicks meant for those rows' own controls. Escaping the table's DOM
            entirely (and its per-row opacity-driven stacking contexts) fixes that at the
            root instead of chasing it with z-index/color tweaks. */}
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={2}
          onEscapeKeyDown={(e) => {
            // No stopPropagation() needed: ImportModal is a Radix Dialog now, and
            // DismissableLayer only arms its Escape listener for the topmost layer,
            // so this popover consumes the key without the modal ever seeing it.
            // First Escape only cancels the inline "new person" form, if it's open;
            // a second Escape (or the first, when not creating) closes the whole
            // popover via Radix's own default handling.
            if (creating) {
              e.preventDefault();
              cancelCreating();
            }
          }}
          className="z-[1000] border border-zinc-300 dark:border-zinc-700 bg-[#f0f0f4] dark:bg-zinc-900 shadow-lg outline-none"
          style={{ width: "max(var(--radix-popover-trigger-width), 160px)" }}
        >
          {creating ? (
            <div ref={formRef} onKeyDown={trapTab} className="p-1.5 flex flex-col gap-1">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (e.target.value.trim()) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="NOVO DEVEDOR"
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-1.5 py-1 text-[10px] tracking-wider text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
              />
              {error && <p className="text-[9px] tracking-wide text-red-500">{error}</p>}
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 border border-zinc-400 dark:border-zinc-600 px-1.5 py-1 text-[9px] tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={cancelCreating}
                  className="flex-1 border border-zinc-300 dark:border-zinc-700 px-1.5 py-1 text-[9px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  closePopover();
                }}
                className={`w-full text-left ${OPTION_SIZE[size]} truncate hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                  value === "" ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                —
              </button>
              {people.map((p) => (
                <button
                  key={p.accessCode}
                  type="button"
                  onClick={() => {
                    onChange(p.accessCode);
                    closePopover();
                  }}
                  className={`w-full text-left ${OPTION_SIZE[size]} truncate hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                    p.accessCode === value ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className={`w-full text-left ${OPTION_SIZE[size]} uppercase truncate border-t border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer`}
              >
                + Novo devedor
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
