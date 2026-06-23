import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPeopleWithBalances } from "@/lib/actions/person";
import { signOutAction } from "@/lib/actions/auth";
import { LeftSidebar } from "@/components/left-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const people = await getPeopleWithBalances();

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/">
            <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-1">
              Sistema
            </p>
            <h1 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
              Debt Tracker
            </h1>
          </Link>
        </div>

        {/* Theme + sign out */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <ThemeToggle />
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Sair
            </button>
          </form>
        </div>

        {/* Search + list + add person */}
        <LeftSidebar people={people} />
      </aside>

      {/* Main content — each page controls its own scroll */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
