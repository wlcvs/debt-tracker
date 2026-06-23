"use client";

import { useActionState } from "react";
import {
  getPersonByAccessCode,
  type ConsultState,
} from "@/lib/actions/person";
import { ConsultarView } from "@/components/consultar-view";
import { ThemeToggle } from "@/components/theme-toggle";

const initialState: ConsultState = { status: "idle" };

export default function ConsultarPage() {
  const [state, action, isPending] = useActionState(
    getPersonByAccessCode,
    initialState
  );

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

        <form action={action} className="flex gap-2 mb-8">
          <input
            type="text"
            name="accessCode"
            placeholder="CÓDIGO DE ACESSO"
            required
            className="flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            disabled={isPending}
            className="border border-zinc-400 dark:border-zinc-600 px-5 py-3 text-xs tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isPending ? "..." : "Ver"}
          </button>
        </form>

        {state.status === "error" && (
          <p className="text-xs tracking-widest text-zinc-500 uppercase">
            {state.message}
          </p>
        )}

        {state.status === "success" && (
          <ConsultarView debtor={state.debtor} accessCode={state.accessCode} />
        )}
      </div>
    </main>
  );
}
