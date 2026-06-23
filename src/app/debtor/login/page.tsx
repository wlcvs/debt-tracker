"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { debtorSignInAction } from "@/lib/actions/debtor-auth";
import { ThemeToggle } from "@/components/theme-toggle";

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

function LoginForm() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [state, action, pending] = useActionState(debtorSignInAction, { status: "idle" });

  return (
    <form action={action} className="flex flex-col gap-4">
      {justRegistered && (
        <p className="text-xs tracking-wider text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          Conta criada. Faça login para continuar.
        </p>
      )}
      {state.status === "error" && (
        <p className="text-xs tracking-wider text-red-500 border border-red-200 dark:border-red-900 px-3 py-2">
          {state.message}
        </p>
      )}

      <input
        type="text"
        inputMode="email"
        name="email"
        placeholder="E-MAIL"
        required
        autoComplete="email"
        className={inputClass}
      />
      <input
        type="password"
        name="password"
        placeholder="SENHA"
        required
        autoComplete="current-password"
        className={inputClass}
      />

      <button
        type="submit"
        disabled={pending}
        className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer mt-2 disabled:opacity-40"
      >
        {pending ? "..." : "Entrar"}
      </button>
    </form>
  );
}

export default function DebtorLoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
              Acesso
            </p>
            <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
              Entrar
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <div className="mt-8 text-center">
          <Link
            href="/debtor/register"
            className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors"
          >
            Primeiro acesso? Cadastre-se
          </Link>
        </div>
      </div>
    </main>
  );
}
