import { getMyAccount, debtorSignOutAction } from "@/lib/actions/debtor-auth";
import { ConsultarView } from "@/components/consultar-view";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function MinhaContaPage() {
  const account = await getMyAccount();

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
              Minha conta
            </p>
            <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
              {account.name}
            </h1>
            {account.phone && (
              <p className="text-xs tracking-widest text-zinc-400 dark:text-zinc-600 mt-1">
                {account.phone}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={debtorSignOutAction}>
              <button
                type="submit"
                className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <ConsultarView debtor={account} />
      </div>
    </main>
  );
}
