"use client";

import { useState } from "react";
import { NewEntryModal } from "@/components/new-entry-modal";

interface Props {
  people: { accessCode: string; name: string }[];
  creditCards: { id: string; label: string }[];
}

/**
 * Dashboard button that opens NewEntryModal.
 *
 * Plain import, unlike StatementImportLauncher's next/dynamic: nothing here reaches
 * pdfjs-dist, so there is no SSR hazard and no bundle worth deferring.
 */
export function NewEntryLauncher({ people, creditCards }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:border-zinc-500 dark:hover:border-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
      >
        + Lançamento
      </button>

      {open && (
        <NewEntryModal people={people} creditCards={creditCards} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
