"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "CONFIRMAR",
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[#c8c8d0] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-6 flex flex-col gap-5 w-full max-w-sm mx-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
            {title}
          </p>
          {description && (
            <p className="text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-xs tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs tracking-widest uppercase border border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-white hover:border-zinc-900 dark:hover:border-white transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
