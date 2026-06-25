"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";

interface Debt {
  id: string;
  amount: number;
  description: string;
  date: Date;
}

interface Payment {
  id: string;
  amount: number;
  date: Date;
  method: string;
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

export function PublicView({ debtor }: Props) {
  const [balanceVisible, setBalanceVisible] = useState(true);

  const methodLabel = (m: string) =>
    PAYMENT_METHODS[m as PaymentMethodKey] ?? m;

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
            className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-pointer"
          >
            {balanceVisible ? "OCULTAR" : "MOSTRAR"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Debts */}
        <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500 mb-3">
          Dívidas
        </p>

        {debtor.debts.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-6">Nenhuma dívida registrada.</p>
        ) : (
          <ul className="flex flex-col gap-1 mb-6">
            {debtor.debts.map((debt) => (
              <li
                key={debt.id}
                className="flex justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-900 text-zinc-700 dark:text-zinc-300"
              >
                <span className="truncate mr-4">{debt.description}</span>
                <span className="shrink-0 tracking-tight">
                  R$ {debt.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Payments */}
        <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500 mb-3">
          Pagamentos
        </p>

        {debtor.payments.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Nenhum pagamento registrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {debtor.payments.map((payment) => (
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
                <div className="mt-0.5">
                  <span className="text-[10px] tracking-wider text-zinc-400 dark:text-zinc-600">
                    {methodLabel(payment.method)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
