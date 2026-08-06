"use client";

import { useState } from "react";
import { createPayment } from "@/lib/actions/payment";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { DateField } from "@/components/date-field";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

const METHOD_OPTIONS: MethodOption[] = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));

interface Props {
  /** Empty only on the dashboard, whose picker starts with nobody selected. */
  personAccessCode: string;
  onSaved: () => void;
  onCancel: () => void;
  /** Fires once a submit is actually under way, so a caller showing a "saved"
   * confirmation can drop it before this attempt decides its own outcome. */
  onSubmitStart?: () => void;
}

/**
 * The payment form itself, with no opinion about what opens or closes it — the
 * counterpart to DebtForm, split out for the same reason. See that file's comment.
 *
 * Its fields are controlled state rather than uncontrolled inputs (which is what
 * create-payment-form.tsx used to have) because clearing some of them while keeping
 * the date on save is not something form.reset() can express.
 */
export function PaymentForm({ personAccessCode, onSaved, onCancel, onSubmitStart }: Props) {
  const [method, setMethod] = useState("");
  const [methodError, setMethodError] = useState(false);
  const [personError, setPersonError] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState("");

  /** Everything except the date, which is kept so a run of same-day entries is quick. */
  function clearAfterSave() {
    setMethod("");
    setMethodError(false);
    setAmount("");
    setDescription("");
    setSubmitError("");
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        // Unreachable from the person page, where the code is baked into the route.
        if (!personAccessCode) {
          setPersonError(true);
          return;
        }
        setPersonError(false);
        if (!method) {
          setMethodError(true);
          return;
        }
        setMethodError(false);
        setSubmitError("");
        onSubmitStart?.();
        const fd = new FormData(e.currentTarget);
        fd.set("personAccessCode", personAccessCode);
        // Without this, a rejected Server Action leaves the form sitting
        // there with no feedback — the "Salvar não faz nada" bug.
        try {
          await createPayment(fd);
        } catch {
          setSubmitError("Não foi possível salvar. Confira os campos e tente de novo.");
          return;
        }
        clearAfterSave();
        onSaved();
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <div className="flex gap-2 items-start">
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          placeholder="VALOR"
          required
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`w-28 ${inputClass}`}
        />
        <div className="flex-1">
          <DateField
            name="date"
            required
            value={date}
            onChange={setDate}
            className={`w-full ${inputClass} text-zinc-500 dark:text-zinc-400`}
          />
        </div>
      </div>

      <input
        type="text"
        name="description"
        placeholder="DESCRIÇÃO (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={inputClass}
      />

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

      {/* See DebtForm: the `&& !personAccessCode` clears this on selection. */}
      {personError && !personAccessCode && (
        <p className="text-xs text-red-500 tracking-wide">Selecione o devedor.</p>
      )}
      {submitError && <p className="text-xs text-red-500 tracking-wide">{submitError}</p>}

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          onClick={() => setMethodError(!method)}
          className="border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
