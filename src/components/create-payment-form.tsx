"use client";

import { useRef, useState } from "react";
import { createPayment } from "@/lib/actions/payment";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { DateField } from "@/components/date-field";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

const METHOD_OPTIONS: MethodOption[] = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));

interface Props {
  accessCode: string;
}

export function CreatePaymentForm({ accessCode }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("");
  const [methodError, setMethodError] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  function reset() {
    setMethod("");
    setMethodError(false);
    setSubmitError("");
    setOpen(false);
  }

  useDismiss(wrapperRef, reset);

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        + Adicionar pagamento
      </button>

      {open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!method) {
              setMethodError(true);
              return;
            }
            setMethodError(false);
            setSubmitError("");
            const fd = new FormData(e.currentTarget);
            // Without this, a rejected Server Action leaves the form sitting
            // there with no feedback — the "Salvar não faz nada" bug.
            try {
              await createPayment(fd);
            } catch {
              setSubmitError("Não foi possível salvar. Confira os campos e tente de novo.");
              return;
            }
            reset();
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="personAccessCode" value={accessCode} />

          <div className="flex gap-2 items-start">
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              placeholder="VALOR"
              required
              autoComplete="off"
              className={`w-28 ${inputClass}`}
            />
            <div className="flex-1">
              <DateField name="date" required className={`w-full ${inputClass} text-zinc-500 dark:text-zinc-400`} />
            </div>
          </div>

          <input type="text" name="description" placeholder="DESCRIÇÃO (opcional)" className={inputClass} />

          <MethodSelect
            name="method"
            options={METHOD_OPTIONS}
            value={method}
            onChange={(v) => {
              setMethod(v);
              setMethodError(false);
            }}
            error={methodError}
          />

          {submitError && <p className="text-xs text-red-500 tracking-wide">{submitError}</p>}

          <div className="flex gap-3 items-center">
            <button
              type="submit"
              onClick={() => setMethodError(!method)}
              className="border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Salvar
            </button>
            <button type="button" onClick={reset} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
