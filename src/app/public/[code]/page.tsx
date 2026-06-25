import { notFound } from "next/navigation";
import { getDebtorViewById } from "@/lib/actions/person";
import { PublicView } from "@/components/public-view";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function PublicDirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const debtor = await getDebtorViewById(code);

  if (!debtor) notFound();

  return (
    <div className="min-h-dvh bg-[#f0f0f4] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-400 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
          Debt Tracker
        </h1>
        <ThemeToggle />
      </header>
      <main className="max-w-md mx-auto px-4 sm:px-8 py-8">
        <h2 className="text-xl tracking-widest uppercase text-zinc-900 dark:text-white mb-6">
          Minha Dívida
        </h2>
        <PublicView debtor={debtor} />
      </main>
    </div>
  );
}
