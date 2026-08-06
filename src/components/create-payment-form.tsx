"use client";

import { useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { PaymentForm } from "@/components/payment-form";
import { useDismiss } from "@/lib/hooks/use-dismiss";

interface Props {
  accessCode: string;
}

/** The person page's "+ Adicionar pagamento" disclosure — see CreateDebtForm. */
export function CreatePaymentForm({ accessCode }: Props) {
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
          + Adicionar pagamento
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <PaymentForm
          personAccessCode={accessCode}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
