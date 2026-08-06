"use client";

import { useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { DebtForm } from "@/components/debt-form";
import { useDismiss } from "@/lib/hooks/use-dismiss";

interface Props {
  accessCode: string;
  creditCards: { id: string; label: string }[];
}

/**
 * The person page's "+ Adicionar dívida" disclosure around DebtForm.
 *
 * Collapsible owns the open state and the aria wiring; useDismiss owns the
 * outside-click, which Collapsible has no notion of — the same division of labour
 * the filter panels use. Closing unmounts the Content, so the form's state resets
 * on its own and this shell holds none of it.
 */
export function CreateDebtForm({ accessCode, creditCards }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapperRef, () => setOpen(false));

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} ref={wrapperRef}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          + Adicionar dívida
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <DebtForm
          personAccessCode={accessCode}
          creditCards={creditCards}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
