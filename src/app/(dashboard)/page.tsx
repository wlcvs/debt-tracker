import Link from "next/link";
import { getOverviewStats, getPeopleWithBalances, createPerson } from "@/lib/actions/person";
import { getCreditCards, deleteCreditCard, createCreditCard } from "@/lib/actions/credit-card";
import { TotalDisplay } from "@/components/total-display";

export default async function OverviewPage() {
  const [stats, people, creditCards] = await Promise.all([
    getOverviewStats(),
    getPeopleWithBalances(),
    getCreditCards(),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <TotalDisplay total={stats.totalToReceive} />

      {/* Stats grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Devedores ativos", value: stats.activeDebtors },
          { label: "Total de pessoas", value: stats.totalDebtors },
          { label: "Dívidas registradas", value: stats.totalDebts },
          { label: "Pagamentos recebidos", value: stats.totalPayments },
          {
            label: "Total já pago",
            value: `R$ ${stats.totalPaid.toFixed(2)}`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border border-zinc-200 dark:border-zinc-800 px-5 py-4"
          >
            <p className="text-xs tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500 mb-2">
              {stat.label}
            </p>
            <p className="text-2xl tracking-tight text-zinc-900 dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* People */}
      <section className="max-w-sm">
        <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-4">
          Devedores
        </p>

        {people.length > 0 && (
          <ul className="flex flex-col mb-4">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/person/${person.id}`}
                  className="flex items-baseline justify-between py-2 border-b border-zinc-200 dark:border-zinc-900 text-xs tracking-widest uppercase hover:opacity-70 transition-opacity"
                >
                  <span className="text-zinc-700 dark:text-zinc-300 truncate mr-4">
                    {person.name}
                  </span>
                  <span
                    className={
                      person.totalOwed > 0
                        ? "shrink-0 text-zinc-900 dark:text-white"
                        : "shrink-0 text-zinc-400 dark:text-zinc-600"
                    }
                  >
                    R$ {person.totalOwed.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form action={createPerson} className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="NOVO DEVEDOR"
            required
            className="flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="shrink-0 border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            +
          </button>
        </form>
      </section>

      {/* Credit cards */}
      <section className="max-w-sm">
        <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-4">
          Cartões
        </p>

        {creditCards.length > 0 && (
          <ul className="flex flex-col mb-4">
            {creditCards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between text-xs tracking-widest uppercase py-2 border-b border-zinc-200 dark:border-zinc-900 text-zinc-600 dark:text-zinc-400"
              >
                <span>{card.label}</span>
                <form action={deleteCreditCard}>
                  <input type="hidden" name="id" value={card.id} />
                  <button
                    type="submit"
                    className="text-zinc-400 dark:text-zinc-700 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createCreditCard} className="flex gap-2">
          <input
            type="text"
            name="label"
            placeholder="EX: NUBANK"
            required
            className="flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            +
          </button>
        </form>
      </section>
    </div>
  );
}
