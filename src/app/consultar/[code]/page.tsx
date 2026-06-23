import { notFound } from "next/navigation";
import { getDebtorViewByCode } from "@/lib/actions/person";
import { ConsultarView } from "@/components/consultar-view";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
              Consulta
            </p>
            <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
              Minha Dívida
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <ConsultarView debtor={debtor} accessCode={code} />
      </div>
    </main>
  );
}
