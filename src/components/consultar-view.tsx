"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";

interface Debt {
  id: string;
  amount: number;
  description: string;
  date: Date;
  isCovered: boolean;
}

interface Payment {
  id: string;
  amount: number;
  date: Date;
  method: string;
  debtId: string | null;
}

interface Debtor {
  name: string;
  totalOwed: number;
  debts: Debt[];
  payments: Payment[];
}

interface Props {
  debtor: Debtor;
}

type DebtFilter = "all" | "open" | "covered";
type MethodFilter = "all" | PaymentMethodKey;

export function ConsultarView({ debtor }: Props) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");

  const filteredDebts = debtor.debts.filter((d) => {
    if (debtFilter === "open") return !d.isCovered;
    if (debtFilter === "covered") return d.isCovered;
    return true;
  });

  const filteredPayments = debtor.payments.filter((p) => {
    if (methodFilter === "all") return true;
    return p.method === methodFilter;
  });

  const methodLabel = (m: string) =>
    PAYMENT_METHODS[m as PaymentMethodKey] ?? m;

  const chipClass = (active: boolean) =>
    `px-2 py-1 text-[10px] tracking-widest uppercase border transition-colors cursor-pointer ${
      active
        ? "border-zinc-700 dark:border-zinc-400 text-zinc-900 dark:text-white"
        : "border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-500"
    }`;

  return (
    <section className="border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between gap-4">
        <h2 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
          {debtor.name}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {balanceVisible ? (
            <p className="text-lg tracking-tight text-zinc-900 dark:text-white">
              R$ {debtor.totalOwed.toFixed(2)}
            </p>
          ) : (
            <p className="text-lg tracking-widest text-zinc-400 dark:text-zinc-600">
              ••••••
            </p>
          )}
          <button
            type="button"
            onClick={() => setBalanceVisible((v) => !v)}
            title={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
            className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-pointer"
          >
            {balanceVisible ? "OCULTAR" : "MOSTRAR"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Debts section */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Dívidas
          </p>
          <div className="flex gap-1">
            <button onClick={() => setDebtFilter("all")} className={chipClass(debtFilter === "all")}>Todas</button>
            <button onClick={() => setDebtFilter("open")} className={chipClass(debtFilter === "open")}>Em aberto</button>
            <button onClick={() => setDebtFilter("covered")} className={chipClass(debtFilter === "covered")}>Quitadas</button>
          </div>
        </div>

        {filteredDebts.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-6">Nenhuma dívida encontrada.</p>
        ) : (
          <ul className="flex flex-col gap-1 mb-6">
            {filteredDebts.map((debt) => (
              <li
                key={debt.id}
                className={`flex justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-900 ${
                  debt.isCovered
                    ? "text-zinc-400 dark:text-zinc-600"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2 truncate mr-4">
                  {debt.isCovered && (
                    <span className="shrink-0 text-[9px] tracking-widest border border-zinc-300 dark:border-zinc-700 px-1 py-0.5">
                      PAGO
                    </span>
                  )}
                  <span className="truncate">{debt.description}</span>
                </span>
                <span className="shrink-0 tracking-tight">
                  R$ {debt.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Payments section */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Pagamentos
          </p>
          <div className="flex gap-1">
            <button onClick={() => setMethodFilter("all")} className={chipClass(methodFilter === "all")}>Todos</button>
            {(Object.entries(PAYMENT_METHODS) as [PaymentMethodKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setMethodFilter(key)} className={chipClass(methodFilter === key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Nenhum pagamento encontrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filteredPayments.map((payment) => {
              const linkedDebt = payment.debtId
                ? debtor.debts.find((d) => d.id === payment.debtId)
                : null;
              return (
                <li
                  key={payment.id}
                  className="text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-900 text-zinc-600 dark:text-zinc-300"
                >
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {new Date(payment.date).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="tracking-tight">
                      R$ {payment.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] tracking-wider text-zinc-400 dark:text-zinc-600">
                      {methodLabel(payment.method)}
                      {linkedDebt && ` · ${linkedDebt.description}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
