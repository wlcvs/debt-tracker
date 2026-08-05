"use client";

import { useMemo, useState } from "react";
import { createDebt } from "@/lib/actions/debt";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Checkbox } from "@/components/checkbox";
import { splitInstallmentAmounts, installmentDate, type InstallmentDirection } from "@/lib/installments";
import { formatDateBR } from "@/lib/date-utils";
import { formatCurrency, parseAmountInput } from "@/lib/format-utils";
import { DateField } from "@/components/date-field";

const MIN_INSTALLMENTS = 1;
const MAX_INSTALLMENTS = 60;

// The count is held as raw text so the field can be emptied and retyped.
// Clamping on every keystroke (the old behaviour) destroyed input: with 21 on
// screen, one more digit made "219", which snapped to 60 and swallowed every
// following keystroke. Normalization happens on blur instead.
function clampInstallments(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_INSTALLMENTS) return String(MIN_INSTALLMENTS);
  return String(Math.min(MAX_INSTALLMENTS, Math.trunc(n)));
}

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

interface Props {
  /** Empty only on the dashboard, whose picker starts with nobody selected. */
  personAccessCode: string;
  creditCards: { id: string; label: string }[];
  onSaved: () => void;
  onCancel: () => void;
  /** Fires once a submit is actually under way, so a caller showing a "saved"
   * confirmation can drop it before this attempt decides its own outcome. */
  onSubmitStart?: () => void;
}

/**
 * The debt form itself, with no opinion about what opens or closes it.
 *
 * Split out of create-debt-form.tsx so the dashboard's NewEntryModal can mount the
 * same form against a debtor picked at runtime, while the person page keeps its
 * disclosure. Everything the form knows about the debtor arrives as personAccessCode.
 *
 * On success it clears its fields but deliberately keeps the date, then calls
 * onSaved(). That matters only in the modal, which stays open for the next entry —
 * the person page unmounts the whole form on save, so nothing is retained there.
 */
export function DebtForm({ personAccessCode, creditCards, onSaved, onCancel, onSubmitStart }: Props) {
  const [method, setMethod] = useState("");
  const [methodError, setMethodError] = useState(false);
  const [personError, setPersonError] = useState(false);
  const [paid, setPaid] = useState(false);
  const [installment, setInstallment] = useState(false);
  // String(MIN_INSTALLMENTS) rather than a literal, so the starting value can't
  // drift away from the floor clampInstallments normalizes to.
  const [installmentsInput, setInstallmentsInput] = useState(String(MIN_INSTALLMENTS));
  const [direction, setDirection] = useState<InstallmentDirection>("forward");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidIndexes, setPaidIndexes] = useState<Set<number>>(new Set());
  const [submitError, setSubmitError] = useState("");

  // Numeric view of the text field, for the preview and the submit payload.
  const installments = Number(clampInstallments(installmentsInput));

  const methodOptions: MethodOption[] = [
    { value: "PIX", label: "Pix" },
    { value: "CASH", label: "Dinheiro" },
    ...creditCards.map((c) => ({ value: c.id, label: c.label })),
  ];

  const preview = useMemo(() => {
    if (!installment) return [];
    const total = parseAmountInput(amount);
    const baseDate = date ? new Date(`${date}T00:00:00Z`) : null;
    if (!baseDate || Number.isNaN(total) || total <= 0) return [];
    const amounts = splitInstallmentAmounts(total, installments);
    return amounts.map((value, i) => ({
      index: i + 1,
      amount: value,
      date: installmentDate(baseDate, i + 1, installments, direction),
    }));
  }, [installment, amount, date, installments, direction]);

  // Closing the panel unmounts it, which hides the fact that its state
  // survived — reopening brought back the last count, direction and ticked
  // installments. Reopening should look exactly like opening it the first time.
  function resetInstallmentPanel() {
    setInstallmentsInput(String(MIN_INSTALLMENTS));
    setDirection("forward");
    setPaidIndexes(new Set());
  }

  /** Everything except the date, which is kept so a run of same-day entries is quick. */
  function clearAfterSave() {
    setMethod("");
    setMethodError(false);
    setPaid(false);
    setInstallment(false);
    resetInstallmentPanel();
    setTitle("");
    setDescription("");
    setAmount("");
    setSubmitError("");
  }

  function togglePaidIndex(index: number) {
    setPaidIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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
        if (installment) {
          fd.set("installments", String(installments));
          fd.set("installmentDirection", direction);
          // Lowering the count leaves higher indexes ticked but invisible;
          // without this they'd come back paid if the count went up again.
          const ticked = Array.from(paidIndexes).filter((i) => i <= installments);
          fd.set("paidInstallments", JSON.stringify(ticked));
        } else if (paid) {
          fd.set("paid", "on");
        }
        // Without this, a rejected Server Action leaves the form sitting
        // there with no feedback — the "Salvar não faz nada" bug.
        try {
          await createDebt(fd);
        } catch {
          setSubmitError("Não foi possível salvar. Confira os campos e tente de novo.");
          return;
        }
        clearAfterSave();
        onSaved();
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input
        type="text"
        name="title"
        placeholder="TÍTULO"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={inputClass}
      />
      <input
        type="text"
        name="description"
        placeholder="DESCRIÇÃO (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={inputClass}
      />

      <div className="flex gap-2 items-start">
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          placeholder={installment ? "VALOR TOTAL" : "VALOR"}
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

      <MethodSelect
        name="debtMethod"
        options={methodOptions}
        value={method}
        onChange={(v) => {
          setMethod(v);
          setMethodError(false);
        }}
        error={methodError}
      />

      <Checkbox
        checked={installment}
        onChange={(checked) => {
          setInstallment(checked);
          if (checked) setPaid(false);
          else resetInstallmentPanel();
        }}
        label="Parcelar"
      />

      {installment ? (
        <div className="flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800 p-3">
          <div className="flex gap-2 items-center">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Número de parcelas</p>
              {/* type="text" rather than "number": the native spinner's
                  arrow glyphs are icons, which the HUD design forbids. */}
              <input
                type="text"
                inputMode="numeric"
                aria-label="Número de parcelas"
                value={installmentsInput}
                onChange={(e) => setInstallmentsInput(e.target.value.replace(/\D/g, ""))}
                onBlur={() => setInstallmentsInput(clampInstallments(installmentsInput))}
                className={`w-20 ${inputClass}`}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Parcelas para</p>
            <ToggleGroup.Root
              type="single"
              value={direction}
              onValueChange={(v) => { if (v) setDirection(v as InstallmentDirection); }}
              aria-label="Direção das parcelas"
              className="flex gap-2"
            >
              <ToggleGroup.Item
                value="forward"
                className="border px-3 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 data-[state=on]:border-zinc-900 dark:data-[state=on]:border-white data-[state=on]:text-zinc-900 dark:data-[state=on]:text-white"
              >
                Meses futuros
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="backward"
                className="border px-3 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 data-[state=on]:border-zinc-900 dark:data-[state=on]:border-white data-[state=on]:text-zinc-900 dark:data-[state=on]:text-white"
              >
                Meses passados
              </ToggleGroup.Item>
            </ToggleGroup.Root>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
              {direction === "forward"
                ? "A data informada é a da 1ª parcela."
                : "A data informada é a da última parcela (mais recente)."}
            </p>
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Parcelas (marque as já pagas)</p>
              <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {preview.map((p) => (
                  <li key={p.index} className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <Checkbox
                      checked={paidIndexes.has(p.index)}
                      onChange={() => togglePaidIndex(p.index)}
                      label={`${p.index}/${installments} — ${formatDateBR(p.date)}`}
                    />
                    <span>R$ {formatCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <Checkbox checked={paid} onChange={setPaid} label="Já paga" />
      )}

      {/* The `&& !personAccessCode` clears this the moment someone is picked,
          without an effect — same shape as methodError, which resets on change. */}
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
