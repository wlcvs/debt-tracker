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
    <main>
      <h1>Consultar dívida</h1>

      <form action={action}>
        <input
          type="text"
          name="accessCode"
          placeholder="Código de acesso"
          required
        />
        <button type="submit" disabled={isPending}>
          {isPending ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {state.status === "error" && <p>{state.message}</p>}

      {state.status === "success" && (
        <section>
          <h2>{state.debtor.name}</h2>
          <p>Saldo devedor: R$ {state.debtor.totalOwed.toFixed(2)}</p>

          <h3>Dívidas</h3>
          <ul>
            {state.debtor.debts.map((debt) => (
              <li key={debt.id} style={{ opacity: debt.isCovered ? 0.5 : 1 }}>
                {debt.description} — R$ {debt.amount.toFixed(2)} —{" "}
                {debt.date.toLocaleDateString("pt-BR")}
                {debt.isCovered ? " (coberta)" : ""}
              </li>
            ))}
          </ul>

          <h3>Pagamentos</h3>
          {state.debtor.payments.length === 0 ? (
            <p>Nenhum pagamento registrado.</p>
          ) : (
            <ul>
              {state.debtor.payments.map((payment) => (
                <li key={payment.id}>
                  R$ {payment.amount.toFixed(2)} —{" "}
                  {payment.date.toLocaleDateString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
