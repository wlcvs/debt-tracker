import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh bg-[#e8e8ed] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-300 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <Link href="/">
          <h1 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
            Debt Tracker
          </h1>
        </Link>
        <div className="flex items-center gap-4">
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
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
