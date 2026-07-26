"use client";

import { useEffect, useState } from "react";
import { getDebtInstallmentGroup, toggleDebtsPaidBulk } from "@/lib/actions/debt";
import { createPayment } from "@/lib/actions/payment";
import { formatDateBR, toDateInputValue, DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/format-utils";
import { Checkbox } from "@/components/checkbox";
import { ModalShell } from "@/components/modal-shell";

interface Props {
  installmentGroupId: string;
  title: string;
  onClose: () => void;
}

interface Installment {
  id: string;
  personId: string;
  amount: number;
  title: string;
  date: string;
  paid: boolean;
  installmentIndex: number | null;
  installmentTotal: number | null;
}

export function InstallmentGroupPanel({ installmentGroupId, title, onClose }: Props) {
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registerPayment, setRegisterPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"single" | "perInstallment">("single");
  const [paymentDate, setPaymentDate] = useState(() => toDateInputValue(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CASH">("CASH");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDebtInstallmentGroup(installmentGroupId).then((data) => setInstallments(data as unknown as Installment[]));
  }, [installmentGroupId]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectUnpaid() {
    if (!installments) return;
    setSelected(new Set(installments.filter((i) => !i.paid).map((i) => i.id)));
  }

  async function markPaid(ids: string[]) {
    if (ids.length === 0 || !installments) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("debtIds", JSON.stringify(ids));
      await toggleDebtsPaidBulk(fd);

      if (registerPayment) {
        const targets = installments.filter((i) => ids.includes(i.id));
        if (paymentMode === "single") {
          const total = targets.reduce((s, t) => s + t.amount, 0);
          const pfd = new FormData();
          pfd.set("personId", targets[0].personId);
          pfd.set("amount", String(total));
          pfd.set("description", paymentDescription || title);
          pfd.set("date", paymentDate);
          pfd.set("method", paymentMethod);
          await createPayment(pfd);
        } else {
          for (const t of targets) {
            const pfd = new FormData();
            pfd.set("personId", t.personId);
            pfd.set("amount", String(t.amount));
            pfd.set("description", paymentDescription || `${title} (${t.installmentIndex}/${t.installmentTotal})`);
            pfd.set("date", paymentDate);
            pfd.set("method", paymentMethod);
            await createPayment(pfd);
          }
        }
      }

      const refreshed = await getDebtInstallmentGroup(installmentGroupId);
      setInstallments(refreshed as unknown as Installment[]);
      setSelected(new Set());
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell eyebrow={`Parcelas — ${title}`} onClose={onClose} maxWidthClassName="max-w-md" zIndexClassName="z-50">
        <div className="px-6 py-5 flex flex-col gap-4">
          {!installments ? (
            <p className="text-xs text-zinc-400">Carregando...</p>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={selectUnpaid}
                  className="text-xs tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Selecionar não pagas
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <ul className="flex flex-col gap-1">
                {installments.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <Checkbox
                      disabled={i.paid}
                      checked={selected.has(i.id)}
                      onChange={() => toggleSelect(i.id)}
                      label={`${i.installmentIndex}/${i.installmentTotal} — ${formatDateBR(new Date(i.date))}`}
                    />
                    <div className="flex items-center gap-2">
                      <span className={`text-xs text-zinc-700 dark:text-zinc-300 ${i.paid ? "line-through opacity-50" : ""}`}>
                        R$ {formatCurrency(i.amount)}
                      </span>
                      {!i.paid && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => markPaid([i.id])}
                          className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Marcar paga
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col gap-3">
                <Checkbox checked={registerPayment} onChange={setRegisterPayment} label="Registrar pagamento correspondente" />

                {registerPayment && (
                  <div className="flex flex-col gap-2 pl-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMode("single")}
                        className={`border px-3 py-1.5 text-xs tracking-widest uppercase cursor-pointer ${
                          paymentMode === "single"
                            ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                        }`}
                      >
                        Um pagamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("perInstallment")}
                        className={`border px-3 py-1.5 text-xs tracking-widest uppercase cursor-pointer ${
                          paymentMode === "perInstallment"
                            ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                        }`}
                      >
                        Um por parcela
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        min={DATE_INPUT_MIN}
                        max={DATE_INPUT_MAX}
                        className="flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("PIX")}
                          className={`border px-3 py-2 text-xs tracking-widest uppercase cursor-pointer ${
                            paymentMethod === "PIX"
                              ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                              : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                          }`}
                        >
                          Pix
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("CASH")}
                          className={`border px-3 py-2 text-xs tracking-widest uppercase cursor-pointer ${
                            paymentMethod === "CASH"
                              ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                              : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                          }`}
                        >
                          Dinheiro
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="DESCRIÇÃO (opcional)"
                      value={paymentDescription}
                      onChange={(e) => setPaymentDescription(e.target.value)}
                      className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving || selected.size === 0}
                  onClick={() => markPaid(Array.from(selected))}
                  className="border border-zinc-600 dark:border-zinc-400 px-5 py-2 text-xs tracking-widest uppercase text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-start"
                >
                  Marcar selecionadas como pagas
                </button>
              </div>
            </>
          )}
        </div>
    </ModalShell>
  );
}
