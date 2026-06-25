import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { createDebt } from "@/lib/actions/debt";
import { createPayment } from "@/lib/actions/payment";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { EditableDebt } from "@/components/editable-debt";
import { EditablePayment } from "@/components/editable-payment";
import { EditablePersonHeader } from "@/components/editable-person-header";
import { ShareButton } from "@/components/share-button";
import { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

const selectClass =
  "bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 pl-3 pr-12 py-2 text-xs tracking-wider text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors";

function Select({ children, className = "", ...rest }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        className={`appearance-none w-full ${selectClass} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, creditCards] = await Promise.all([
    getPersonById(id),
    getCreditCards(),
  ]);

  if (!person) notFound();

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-16">
      {/* Person header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 flex flex-col gap-3">
        <EditablePersonHeader person={person} />
        <div className="flex items-center gap-3">
          <ShareButton personId={person.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Debts */}
        <section className="flex flex-col gap-4">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Dívidas
          </p>

          {person.debts.length > 0 && (
            <ul className="flex flex-col">
              {person.debts.map((debt) => (
                <EditableDebt key={debt.id} debt={debt} />
              ))}
            </ul>
          )}

          <form action={createDebt} className="flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 mb-1">
              Nova dívida
            </p>
            <input type="hidden" name="personId" value={person.id} />
            <input
              type="number"
              name="amount"
              step="0.01"
              placeholder="VALOR"
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
            <input
              type="text"
              name="description"
              placeholder="DESCRIÇÃO"
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
            <input
              type="date"
              name="date"
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
            {creditCards.length > 0 && (
              <Select name="creditCardId" className={selectClass}>
                <option value="">SEM CARTÃO</option>
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.label.toUpperCase()}
                  </option>
                ))}
              </Select>
            )}
            <button
              type="submit"
              className="border border-zinc-300 dark:border-zinc-800 py-2 text-xs tracking-widest uppercase text-zinc-500 hover:border-zinc-900 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              + Adicionar
            </button>
          </form>
        </section>

        {/* Payments */}
        <section className="flex flex-col gap-4">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Pagamentos
          </p>

          {person.payments.length > 0 && (
            <ul className="flex flex-col">
              {person.payments.map((payment) => (
                <EditablePayment key={payment.id} payment={payment} />
              ))}
            </ul>
          )}

          <form action={createPayment} className="flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 mb-1">
              Novo pagamento
            </p>
            <input type="hidden" name="personId" value={person.id} />
            <input
              type="number"
              name="amount"
              step="0.01"
              placeholder="VALOR"
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
            <input
              type="date"
              name="date"
              required
              className="bg-transparent border border-zinc-300 dark:border-zinc-800 px-3 py-2 text-xs tracking-wider text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
            <Select name="method" className={selectClass}>
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
            <button
              type="submit"
              className="border border-zinc-300 dark:border-zinc-800 py-2 text-xs tracking-widest uppercase text-zinc-500 hover:border-zinc-900 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              + Adicionar
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
