import { notFound } from "next/navigation";
import { getDebtorViewByCode } from "@/lib/actions/person";

export default async function ConsultarDirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const debtor = await getDebtorViewByCode(code);

  if (!debtor) notFound();

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
            Consulta
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Minha Dívida
          </h1>
        </div>

        <section className="border border-zinc-200 dark:border-zinc-800">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between">
            <h2 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
              {debtor.name}
            </h2>
            <p className="text-lg tracking-tight text-zinc-900 dark:text-white">
              R$ {debtor.totalOwed.toFixed(2)}
            </p>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500 mb-3">
              Dívidas
            </p>
            {debtor.debts.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-6">Nenhuma dívida.</p>
            ) : (
              <ul className="flex flex-col gap-1 mb-6">
                {debtor.debts.map((debt) => (
                  <li
                    key={debt.id}
                    className={`flex justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-900 ${
                      debt.isCovered
                        ? "text-zinc-400 dark:text-zinc-600"
                        : "text-zinc-700 dark:text-zinc-300"
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
                    className="flex justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-900 text-zinc-600 dark:text-zinc-300"
                  >
                    <span>{payment.date.toLocaleDateString("pt-BR")}</span>
                    <span className="tracking-tight">
                      R$ {payment.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
