"use client";

import { useMemo, useState } from "react";
import { updateDebtInstallmentGroup } from "@/lib/actions/debt";
import { MethodSelect, type MethodOption } from "@/components/method-select";
import { DateField } from "@/components/date-field";
import { buildInstallments, clampInstallments } from "@/lib/installments";
import { formatDateBR, toDateInputValue } from "@/lib/date-utils";
import { formatCurrency, parseAmountInput } from "@/lib/format-utils";
import type { Installment } from "@/components/installment-group-panel";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

interface Props {
  installmentGroupId: string;
  /** The purchase's title, already stripped of its "(i/N)" suffix. */
  title: string;
  installments: Installment[];
  creditCards: { id: string; label: string }[];
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Edits a parceled purchase as a whole: title, total, count, first date,
 * description and method.
 *
 * The per-installment "Editar" stays hidden in debt-detail-modal.tsx — editing
 * one row of a group in isolation is what would leave it inconsistent. This
 * form works at the level the group actually is, and the server action rewrites
 * every row from these values.
 */
export function InstallmentGroupForm({
  installmentGroupId,
  title,
  installments,
  creditCards,
  onCancel,
  onSaved,
}: Props) {
  const first = installments[0];
  const originalTotal = installments.reduce((sum, i) => sum + i.amount, 0);

  const [titleValue, setTitleValue] = useState(title);
  const [description, setDescription] = useState(first.description);
  // Prefilled with the comma separator so parseAmountInput reads it back the
  // same way it reads anything the admin types.
  const [amount, setAmount] = useState(() => formatCurrency(originalTotal));
  const [date, setDate] = useState(() => toDateInputValue(new Date(first.date)));
  const [countInput, setCountInput] = useState(String(installments.length));
  const [method, setMethod] = useState(first.creditCardId ?? first.method ?? "");
  const [methodError, setMethodError] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const count = Number(clampInstallments(countInput));
  const paidCount = installments.filter((i) => i.paid).length;

  const methodOptions: MethodOption[] = [
    { value: "PIX", label: "Pix" },
    { value: "CASH", label: "Dinheiro" },
    ...creditCards.map((c) => ({ value: c.id, label: c.label })),
  ];

  // Same preview the create form shows, from the same helper — so what lands
  // in the database can't differ from what was on screen.
  const preview = useMemo(() => {
    const total = parseAmountInput(amount);
    const baseDate = date ? new Date(`${date}T00:00:00Z`) : null;
    if (!baseDate || Number.isNaN(total) || total <= 0) return [];
    return buildInstallments(total, count, baseDate);
  }, [amount, date, count]);

  const droppedPaid = installments.filter((i) => i.paid && (i.installmentIndex ?? 0) > count).length;

  return (
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
        fd.set("installmentGroupId", installmentGroupId);
        fd.set("installments", String(count));
        setSaving(true);
        // A rejected Server Action would otherwise leave the form open with no
        // clue why nothing saved — indistinguishable from a dead button.
        try {
          await updateDebtInstallmentGroup(fd);
        } catch {
          setSubmitError("Não foi possível salvar. Confira os campos e tente de novo.");
          return;
        } finally {
          setSaving(false);
        }
        onSaved();
      }}
      className="px-6 py-5 flex flex-col gap-3"
    >
      <div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Título</p>
        <input
          type="text"
          name="title"
          required
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          placeholder="Ex: Supermercado"
          className={`w-full ${inputClass}`}
        />
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
          O sufixo (1/{count}) é adicionado a cada parcela automaticamente.
        </p>
      </div>

      <div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">
          Descrição <span className="normal-case text-zinc-300 dark:text-zinc-700">(opcional)</span>
        </p>
        <input
          type="text"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Compra do mês"
          className={`w-full ${inputClass}`}
        />
      </div>

      <div className="flex gap-2 items-start">
        <input
          type="text"
          inputMode="decimal"
          name="amount"
          aria-label="Valor total"
          placeholder="VALOR TOTAL"
          required
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`w-28 ${inputClass}`}
        />
        <div className="flex-1">
          <DateField
            name="date"
            aria-label="Data da 1ª parcela"
            required
            value={date}
            onChange={setDate}
            className={`w-full ${inputClass} text-zinc-500 dark:text-zinc-400`}
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Número de parcelas</p>
        {/* type="text" rather than "number": the native spinner's arrow glyphs
            are icons, which the HUD design forbids. Normalized on blur, never
            on change — see clampInstallments. */}
        <input
          type="text"
          inputMode="numeric"
          aria-label="Número de parcelas"
          value={countInput}
          onChange={(e) => setCountInput(e.target.value.replace(/\D/g, ""))}
          onBlur={() => setCountInput(clampInstallments(countInput))}
          className={`w-20 ${inputClass}`}
        />
      </div>

      <div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Método</p>
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
      </div>

      {preview.length > 0 && (
        <div>
          <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Parcelas após salvar</p>
          <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {preview.map((p) => (
              <li
                key={p.index}
                className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span>
                  {p.index}/{count} — {formatDateBR(p.date)}
                </span>
                <span>R$ {formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The paid flags survive the rewrite, but only for rows that still
          exist — say so before the admin shrinks a group they already ticked. */}
      {paidCount > 0 && (
        <p className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600">
          {droppedPaid > 0
            ? `${droppedPaid} parcela(s) já paga(s) serão removidas. Pagamentos registrados não são apagados.`
            : `${paidCount} parcela(s) já paga(s) continuam marcadas.`}
        </p>
      )}

      {submitError && <p className="text-xs text-red-500 tracking-wide">{submitError}</p>}

      <div className="flex gap-3 items-center pt-1">
        <button
          type="submit"
          disabled={saving}
          onClick={() => setMethodError(!method)}
          className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
