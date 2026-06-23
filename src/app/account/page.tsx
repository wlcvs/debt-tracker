import { getMyAccount, debtorSignOutAction, updateEmailNotifications } from "@/lib/actions/debtor-auth";
import { PublicView } from "@/components/public-view";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AccountPage() {
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

        <PublicView debtor={account} />

        {/* Notification preference */}
        <form action={updateEmailNotifications} className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="emailNotifications"
              defaultChecked={account.emailNotifications}
              className="mt-0.5 accent-zinc-700 dark:accent-zinc-300 cursor-pointer"
            />
            <span className="text-xs tracking-wide text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Receber notificações por e-mail sobre novas dívidas e pagamentos
            </span>
          </label>
          <button
            type="submit"
            className="mt-3 text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Salvar preferência
          </button>
        </form>
      </div>
    </main>
  );
}
