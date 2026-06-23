"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/actions/password-reset";
import { use } from "react";
import Link from "next/link";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const action = resetPassword.bind(null, token);
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  const inputClass =
    "bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
            Sistema
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Nova Senha
          </h1>
        </div>

        {state.status === "success" ? (
          <div className="border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 tracking-wide mb-4">
              Senha redefinida com sucesso.
            </p>
            <Link
              href="/login"
              className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Fazer login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state.status === "error" && (
              <p className="text-xs tracking-wider text-red-500 border border-red-200 dark:border-red-900 px-3 py-2">
                {state.message}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <input
                type="password"
                name="password"
                placeholder="NOVA SENHA"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
              <p className="text-xs tracking-wider text-zinc-400 dark:text-zinc-600">
                Mínimo 8 caracteres
              </p>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              {pending ? "Salvando..." : "Redefinir senha"}
            </button>

            <Link
              href="/login"
              className="text-center text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors"
            >
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
