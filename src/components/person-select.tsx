"use client";

import { useEffect, useRef, useState } from "react";
import { createPerson } from "@/lib/actions/person";

interface PersonOption {
  id: string;
  name: string;
}

interface Props {
  people: PersonOption[];
  value: string;
  onChange: (value: string) => void;
  onPersonCreated: (person: PersonOption) => void;
  placeholder?: string;
}

export function PersonSelect({ people, value, onChange, onPersonCreated, placeholder = "—" }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // mousedown, not click: a click on "+ Novo devedor" swaps this popover's own
    // contents synchronously (options list -> create form), which would detach
    // e.target from the DOM before a same-phase "click" listener here could see it
    // as still contained in wrapperRef. mousedown fires before that re-render.
    function onMouseDownOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closePopover();
      }
    }
    document.addEventListener("mousedown", onMouseDownOutside);
    return () => document.removeEventListener("mousedown", onMouseDownOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Capture phase, not bubble: reverting from the create-form back to the
    // options list unmounts the focused input, so focus falls back to
    // document.body — a later Escape press then has no PersonSelect element
    // in its bubble path and would otherwise reach ImportModal's window
    // listener directly. A capture-phase listener intercepts Escape before
    // it can propagate that far, regardless of what currently has focus.
    function onEscapeCapture(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (creating) {
        setCreating(false);
        setNewName("");
        setError("");
      } else {
        closePopover();
      }
    }
    window.addEventListener("keydown", onEscapeCapture, true);
    return () => window.removeEventListener("keydown", onEscapeCapture, true);
  }, [open, creating]);

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

  function closePopover() {
    setOpen(false);
    setCreating(false);
    setNewName("");
    setError("");
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
    onChange(person.id);
    closePopover();
  }

  const selected = people.find((p) => p.id === value);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-1 py-0.5 text-[10px] tracking-wider focus:outline-none transition-colors cursor-pointer ${
          selected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <span className="text-[9px] text-zinc-400 ml-1 shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 left-0 right-0 top-full mt-px border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 min-w-max">
          {creating ? (
            <div ref={formRef} onKeyDown={trapTab} className="p-1.5 flex flex-col gap-1 w-40">
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
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setError("");
                  }}
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
                className={`w-full text-left px-2 py-1 text-[10px] tracking-wider whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                  value === "" ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                —
              </button>
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    closePopover();
                  }}
                  className={`w-full text-left px-2 py-1 text-[10px] tracking-wider whitespace-nowrap hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                    p.id === value ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-2 py-1 text-[10px] tracking-widest uppercase whitespace-nowrap border-t border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                + Novo devedor
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
