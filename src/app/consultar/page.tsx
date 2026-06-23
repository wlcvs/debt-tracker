"use client";

import { useActionState } from "react";
import {
  getPersonByAccessCode,
  type ConsultState,
} from "@/lib/actions/person";

const initialState: ConsultState = { status: "idle" };

export default function ConsultarPage() {
  const [state, action, isPending] = useActionState(
    getPersonByAccessCode,
    initialState
  );

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-2">
            Consulta
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-white">
            Minha Dívida
          </h1>
        </div>

        <form action={action} className="flex gap-2 mb-8">
          <input
            type="text"
            name="accessCode"
            placeholder="CÓDIGO DE ACESSO"
            required
            className="flex-1 bg-transparent border border-zinc-700 px-4 py-3 text-sm tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            disabled={isPending}
            className="border border-zinc-600 px-5 py-3 text-xs tracking-[0.2em] uppercase text-zinc-400 hover:border-white hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isPending ? "..." : "Ver"}
          </button>
        </form>

        {state.status === "error" && (
          <p className="text-xs tracking-widest text-zinc-500 uppercase">
            {state.message}
          </p>
        )}

        {state.status === "success" && (
          <section className="border border-zinc-800">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-baseline justify-between">
              <h2 className="text-sm tracking-widest uppercase text-white">
                {state.debtor.name}
              </h2>
              <p className="text-lg tracking-tight text-white">
                R$ {state.debtor.totalOwed.toFixed(2)}
              </p>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-3">
                Dívidas
              </p>
              {state.debtor.debts.length === 0 ? (
                <p className="text-xs text-zinc-600">Nenhuma dívida.</p>
              ) : (
                <ul className="flex flex-col gap-1 mb-6">
                  {state.debtor.debts.map((debt) => (
                    <li
                      key={debt.id}
                      className={`flex justify-between text-xs py-1 border-b border-zinc-900 ${
                        debt.isCovered ? "text-zinc-600" : "text-zinc-300"
                      }`}
                    >
                      <span className="truncate mr-4">{debt.description}</span>
                      <span className="shrink-0 tracking-tight">
                        R$ {debt.amount.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-3">
                Pagamentos
              </p>
              {state.debtor.payments.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {state.debtor.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex justify-between text-xs py-1 border-b border-zinc-900 text-zinc-300"
                    >
                      <span>
                        {payment.date.toLocaleDateString("pt-BR")}
                      </span>
                      <span className="tracking-tight">
                        R$ {payment.amount.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
