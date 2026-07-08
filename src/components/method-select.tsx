"use client";

import { useEffect, useRef, useState } from "react";

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
}

export function MethodSelect({ name, options, value, onChange, error, placeholder = "— Método —" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left flex justify-between items-center bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest focus:outline-none transition-colors cursor-pointer ${
          selected ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
        }`}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span className="text-[10px] text-zinc-400 ml-2">▾</span>
      </button>
      {error && <p className="text-xs text-red-500 mt-1 tracking-wide">Campo obrigatório</p>}
      {open && (
        <div className="absolute z-20 left-0 right-0 top-full mt-px border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 max-h-40 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                opt.value === value ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
