"use client";

import { useMemo, useState, type RefObject } from "react";
import { PersonSelect } from "@/components/person-select";
import type { MethodOption } from "@/components/method-select";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { DATE_INPUT_MIN, DATE_INPUT_MAX, formatDateBR } from "@/lib/date-utils";
import { parseBrAmount } from "@/lib/importers/base";
import { formatAmount, type EditingCell, type Txn, type TxnType } from "@/lib/import-modal-types";

const PAYMENT_METHOD_OPTIONS: MethodOption[] = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));

// Shared by every compact inline control in this table (Tipo/Método selects,
// Data/Valor inputs, the bulk-apply select) so the row stays visually
// consistent — a wider MethodSelect-style control looked out of place and
// wrapped its placeholder text across multiple lines in a narrow column.
const compactControlClass =
  "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-1 py-0.5 text-[10px] tracking-wider text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors";

interface Props {
  currentTxns: Txn[];
  localPeople: { id: string; name: string }[];
  setLocalPeople: (updater: (prev: { id: string; name: string }[]) => { id: string; name: string }[]) => void;
  creditCards: { id: string; label: string }[];
  patchCurrentTxn: (index: number | string, patch: Partial<Txn>) => void;
  selectedTxnIndex: number | string | null;
  onSelectTxn: (t: Txn) => void;
  // Kept controlled by the parent (not owned here): ImportModal's Dialog.Content
  // reads this exact state from onEscapeKeyDown, and feeds it to
  // useInlineEditGuard for the outside-click case, so that ending a cell edit
  // does not also close the whole modal.
  editingCell: EditingCell;
  setEditingCell: (cell: EditingCell) => void;
  tableBodyRef: RefObject<HTMLTableSectionElement | null>;
  search: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterAmountMin: string;
  filterAmountMax: string;
  sortKey: "date" | "amount";
  sortDir: "asc" | "desc";
  step: "upload" | "processing" | "review" | "saving";
  onClose: () => void;
  onSave: () => void;
}

export function TransactionTable({
  currentTxns,
  localPeople,
  setLocalPeople,
  creditCards,
  patchCurrentTxn,
  selectedTxnIndex,
  onSelectTxn,
  editingCell,
  setEditingCell,
  tableBodyRef,
  search,
  filterDateFrom,
  filterDateTo,
  filterAmountMin,
  filterAmountMax,
  sortKey,
  sortDir,
  step,
  onClose,
  onSave,
}: Props) {
  const [editingValue, setEditingValue] = useState("");

  const debtMethodOptions: MethodOption[] = useMemo(
    () => [
      { value: "PIX", label: "Pix" },
      { value: "CASH", label: "Dinheiro" },
      ...creditCards.map((c) => ({ value: c.id, label: c.label })),
    ],
    [creditCards]
  );

  function startEditing(t: Txn, field: "description" | "date" | "amount") {
    setEditingCell({ index: t.index, field });
    setEditingValue(field === "description" ? t.description : field === "date" ? t.date : formatAmount(t.amount));
  }

  function cancelEditing() {
    setEditingCell(null);
  }

  function commitEditing() {
    if (!editingCell) return;
    const { index, field } = editingCell;
    setEditingCell(null);
    if (field === "description") {
      const trimmed = editingValue.trim();
      if (trimmed) patchCurrentTxn(index, { description: trimmed });
    } else if (field === "date") {
      if (editingValue) patchCurrentTxn(index, { date: editingValue });
    } else {
      const parsed = parseBrAmount(editingValue);
      if (parsed !== null) patchCurrentTxn(index, { amount: parsed });
    }
  }

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const amtMin = filterAmountMin !== "" ? parseFloat(filterAmountMin) : null;
    const amtMax = filterAmountMax !== "" ? parseFloat(filterAmountMax) : null;

    let txns = currentTxns;
    if (q) {
      txns = txns.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.date.includes(q) ||
          formatAmount(t.amount).includes(q)
      );
    }
    if (filterDateFrom) txns = txns.filter((t) => t.date >= filterDateFrom);
    if (filterDateTo) txns = txns.filter((t) => t.date <= filterDateTo);
    if (amtMin !== null) txns = txns.filter((t) => Math.abs(parseFloat(String(t.amount))) >= amtMin);
    if (amtMax !== null) txns = txns.filter((t) => Math.abs(parseFloat(String(t.amount))) <= amtMax);

    return [...txns].sort((a, b) => {
      let av: string | number = sortKey === "amount" ? parseFloat(String(a.amount)) : a[sortKey];
      let bv: string | number = sortKey === "amount" ? parseFloat(String(b.amount)) : b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [currentTxns, search, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax, sortKey, sortDir]);

  const readyTxns = useMemo(() => currentTxns.filter((t) => t.type !== "ignore" && t.personId), [currentTxns]);
  const readyCount = readyTxns.length;
  const readyTotal = useMemo(
    () => readyTxns.reduce((sum, t) => sum + Math.abs(parseFloat(String(t.amount)) || 0), 0),
    [readyTxns]
  );

  return (
    <>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[620px] text-xs border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 90 }} />
            <col />
            <col style={{ width: 88 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead className="sticky top-0 bg-[#f0f0f4] dark:bg-zinc-900 z-10">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left pl-3 pr-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">Data</th>
              <th className="text-left px-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Descrição</th>
              <th className="text-left pl-1 pr-3 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600 whitespace-nowrap">Valor</th>
              <th className="text-left px-1 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Devedor</th>
              <th className="text-left pl-1 pr-3 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Tipo</th>
              <th className="text-left pl-1 pr-3 py-2 font-normal tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Método</th>
            </tr>
          </thead>
          <tbody ref={tableBodyRef}>
            {filteredTransactions.map((t) => (
              <tr
                key={t.index}
                data-txn-index={t.index}
                className={`border-b border-zinc-100 dark:border-zinc-800/60 transition-all cursor-pointer ${t.type === "ignore" || !t.personId ? "opacity-30" : ""} ${
                  t.index === selectedTxnIndex ? "bg-zinc-300/60 dark:bg-zinc-700/50" : ""
                }`}
                onClick={() => onSelectTxn(t)}
              >
                <td className="pl-3 pr-1 py-1.5" onClick={(e) => e.stopPropagation()}>
                  {editingCell?.index === t.index && editingCell.field === "date" ? (
                    <input
                      autoFocus
                      type="date"
                      value={editingValue}
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditing();
                        }
                      }}
                      className="w-full bg-transparent border-b border-zinc-400 dark:border-zinc-500 text-[11px] text-zinc-900 dark:text-zinc-100 focus:outline-none scheme-light dark:scheme-dark"
                    />
                  ) : (
                    <span
                      className="block truncate tabular-nums text-[11px] text-zinc-700 dark:text-zinc-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(t, "date");
                      }}
                    >
                      {formatDateBR(new Date(t.date))}
                    </span>
                  )}
                </td>
                <td className="px-1 py-1.5 text-zinc-900 dark:text-zinc-100 overflow-hidden">
                  {editingCell?.index === t.index && editingCell.field === "description" ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditing();
                        }
                      }}
                      className="w-full bg-transparent border-b border-zinc-400 dark:border-zinc-500 text-[11px] text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="block truncate text-[11px]"
                      title={t.description}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(t, "description");
                      }}
                    >
                      {t.description}
                    </span>
                  )}
                  {t.manual && <span className="text-[9px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500">manual</span>}
                </td>
                <td className="pl-1 pr-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  {editingCell?.index === t.index && editingCell.field === "amount" ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditing();
                        }
                      }}
                      className="w-full bg-transparent border-b border-zinc-400 dark:border-zinc-500 text-[11px] text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="block truncate tabular-nums text-[11px] text-zinc-900 dark:text-zinc-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(t, "amount");
                      }}
                    >
                      R${formatAmount(t.amount)}
                    </span>
                  )}
                </td>
                <td className="px-1 py-1.5 overflow-visible" onClick={(e) => e.stopPropagation()}>
                  <PersonSelect
                    people={localPeople}
                    value={t.personId}
                    onChange={(personId) =>
                      patchCurrentTxn(t.index, { personId, type: personId && t.type === "ignore" ? "debt" : t.type })
                    }
                    onPersonCreated={(p) =>
                      setLocalPeople((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
                    }
                  />
                </td>
                <td className="pl-1 pr-3 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={t.type}
                    onChange={(e) => {
                      const type = e.target.value as TxnType;
                      patchCurrentTxn(t.index, { type, personId: type === "ignore" ? "" : t.personId });
                    }}
                    className={compactControlClass}
                  >
                    <option value="ignore">Ignorar</option>
                    <option value="debt">Dívida</option>
                    <option value="payment">Pgto</option>
                  </select>
                </td>
                <td className="pl-1 pr-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  {t.type === "ignore" ? (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">—</span>
                  ) : (
                    <select
                      value={t.method ?? ""}
                      onChange={(e) => patchCurrentTxn(t.index, { method: e.target.value })}
                      className={compactControlClass}
                    >
                      <option value="" disabled>—</option>
                      {(t.type === "debt" ? debtMethodOptions : PAYMENT_METHOD_OPTIONS).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <p className="text-[10px] tracking-wider text-zinc-500 dark:text-zinc-400">
          {readyCount} prontos
          {readyCount > 0 && <> · R$ {formatAmount(readyTotal)}</>}
        </p>
        <div className="flex gap-3 items-center">
          <button onClick={onClose} className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={readyCount === 0 || step === "saving"}
            className={`border px-4 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
              readyCount > 0
                ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            }`}
          >
            {step === "saving" ? "Salvando…" : "Importar"}
          </button>
        </div>
      </div>
    </>
  );
}
