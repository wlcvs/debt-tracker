import Link from "next/link";
import { getOverviewStats, getPeopleWithBalances } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { TotalDisplay } from "@/components/total-display";
import { CreditCardList } from "@/components/credit-card-list";
import { CreatePersonForm } from "@/components/create-person-form";
import { CreateCreditCardForm } from "@/components/create-credit-card-form";
import { StatementImportLauncher } from "@/components/statement-import-launcher";

// Bank statement import (PDF parsing + optional LLM extraction) can take a
// while — raise this route's serverless duration ceiling above Vercel's
// default. See src/lib/actions/statement.ts for why this can't live there.
export const maxDuration = 300;

export default async function OverviewPage() {
  const [stats, people, creditCards] = await Promise.all([
    getOverviewStats(),
    getPeopleWithBalances(),
    getCreditCards(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-start justify-between gap-4">
        <TotalDisplay total={stats.totalToReceive} />
        <StatementImportLauncher people={people.map((p) => ({ id: p.id, name: p.name }))} />
      </div>

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

      {/* People + Credit cards */}
      <div className="flex flex-col sm:flex-row gap-10">

      {/* People */}
      <section className="max-w-sm flex-1">
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

        <CreatePersonForm />
      </section>

      {/* Credit cards */}
      <section className="max-w-sm flex-1">
        <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-4">
          Cartões
        </p>

        {creditCards.length > 0 && <CreditCardList cards={creditCards} />}

        <CreateCreditCardForm />
      </section>

      </div>
    </div>
  );
}
