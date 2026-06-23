import { getPeopleWithBalances } from "@/lib/actions/person";
import { createPerson } from "@/lib/actions/person";
import { createDebt } from "@/lib/actions/debt";
import { createPayment } from "@/lib/actions/payment";
import { createCreditCard, getCreditCards, deleteCreditCard } from "@/lib/actions/credit-card";
import { signOutAction } from "@/lib/actions/auth";
import { EditableDebt } from "@/components/editable-debt";
import { EditablePayment } from "@/components/editable-payment";
import { EditablePersonHeader } from "@/components/editable-person-header";

export default async function Home() {
  const [people, creditCards] = await Promise.all([
    getPeopleWithBalances(),
    getCreditCards(),
  ]);

  const totalToReceive = people.reduce((sum, p) => sum + p.totalOwed, 0);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <header className="flex items-baseline justify-between mb-12 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-1">
            Sistema
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-white">
            Debt Tracker
          </h1>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-xs tracking-[0.2em] uppercase text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            Sair
          </button>
        </form>
      </header>

      {/* Total */}
      <section className="mb-12">
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-1">
          Total a receber
        </p>
        <p className="text-4xl tracking-tight text-white">
          R$ {totalToReceive.toFixed(2)}
        </p>
      </section>

      {/* Actions */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-14">
        <div className="border border-zinc-800 p-5">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-4">
            Nova pessoa
          </p>
          <form action={createPerson} className="flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="NOME"
              required
              className="flex-1 bg-transparent border border-zinc-700 px-3 py-2 text-sm tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
            />
            <button
              type="submit"
              className="border border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase text-zinc-400 hover:border-white hover:text-white transition-colors cursor-pointer"
            >
              Adicionar
            </button>
          </form>
        </div>

        <div className="border border-zinc-800 p-5">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-4">
            Cartões
          </p>
          <form action={createCreditCard} className="flex gap-2 mb-3">
            <input
              type="text"
              name="label"
              placeholder="EX: NUBANK"
              required
              className="flex-1 bg-transparent border border-zinc-700 px-3 py-2 text-sm tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
            />
            <button
              type="submit"
              className="border border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase text-zinc-400 hover:border-white hover:text-white transition-colors cursor-pointer"
            >
              Adicionar
            </button>
          </form>
          {creditCards.length > 0 && (
            <ul className="flex flex-col gap-1">
              {creditCards.map((card) => (
                <li key={card.id} className="flex items-center justify-between text-xs text-zinc-500 py-1 border-b border-zinc-900">
                  <span className="tracking-widest uppercase">{card.label}</span>
                  <form action={deleteCreditCard}>
                    <input type="hidden" name="id" value={card.id} />
                    <button
                      type="submit"
                      className="text-zinc-700 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* People */}
      <section>
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-6">
          Pessoas — {people.length}
        </p>

        <div className="flex flex-col gap-8">
          {people.map((person) => (
            <div key={person.id} className="border border-zinc-800">
              <EditablePersonHeader person={person} />

              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Debts */}
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-3">
                    Dívidas
                  </p>
                  {person.debts.length === 0 ? (
                    <p className="text-xs text-zinc-600 mb-4">Nenhuma dívida.</p>
                  ) : (
                    <ul className="flex flex-col mb-4">
                      {person.debts.map((debt) => (
                        <EditableDebt key={debt.id} debt={debt} />
                      ))}
                    </ul>
                  )}

                  <form action={createDebt} className="flex flex-col gap-2">
                    <input type="hidden" name="personId" value={person.id} />
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      placeholder="VALOR"
                      required
                      className="bg-transparent border border-zinc-800 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <input
                      type="text"
                      name="description"
                      placeholder="DESCRIÇÃO"
                      required
                      className="bg-transparent border border-zinc-800 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <input
                      type="date"
                      name="date"
                      required
                      className="bg-transparent border border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <select
                      name="creditCardId"
                      className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
                    >
                      <option value="">SEM CARTÃO</option>
                      {creditCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.label.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="border border-zinc-800 py-2 text-xs tracking-widest uppercase text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      + Dívida
                    </button>
                  </form>
                </div>

                {/* Payments */}
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase text-zinc-500 mb-3">
                    Pagamentos
                  </p>

                  {person.payments && person.payments.length > 0 && (
                    <ul className="flex flex-col mb-4">
                      {person.payments.map((payment) => (
                        <EditablePayment key={payment.id} payment={payment} />
                      ))}
                    </ul>
                  )}

                  <form action={createPayment} className="flex flex-col gap-2">
                    <input type="hidden" name="personId" value={person.id} />
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      placeholder="VALOR"
                      required
                      className="bg-transparent border border-zinc-800 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <input
                      type="date"
                      name="date"
                      required
                      className="bg-transparent border border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <button
                      type="submit"
                      className="border border-zinc-800 py-2 text-xs tracking-widest uppercase text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      + Pagamento
                    </button>
                  </form>
                </div>
              </div>

              {/* Access code */}
              <div className="px-5 py-3 border-t border-zinc-900">
                <p className="text-xs text-zinc-700 tracking-widest">
                  CÓDIGO{" "}
                  <span className="text-zinc-500">{person.accessCode}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
