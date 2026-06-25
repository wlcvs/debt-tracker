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
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-start justify-between">
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Minha Dívida
          </h1>
          <ThemeToggle />
        </div>
        <PublicView debtor={debtor} />
      </div>
    </main>
  );
}
