import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPeopleWithBalances } from "@/lib/actions/person";
import { signOutAction } from "@/lib/actions/auth";
import { LeftSidebar } from "@/components/left-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardShell } from "@/components/dashboard-shell";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const people = await getPeopleWithBalances();

  const sidebar = (
    <>
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/">
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
    </>
  );

  return <DashboardShell sidebar={sidebar}>{children}</DashboardShell>;
}
