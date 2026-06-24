import { getOverviewStats } from "@/lib/actions/person";
import { getCreditCards, deleteCreditCard, createCreditCard } from "@/lib/actions/credit-card";
import { TotalDisplay } from "./TotalDisplay";

export default async function OverviewPage() {
  const [stats, creditCards] = await Promise.all([
    getOverviewStats(),
    getCreditCards(),
  ]);

  return (
    <div className="px-8 py-10 h-full flex flex-col gap-10">
      {/* Total */}
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

      {/* Credit cards */}
      <section className="max-w-xs">
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
