"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {
    status: "idle",
  });

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-1">
          Sistema
        </p>
        <h1 className="text-2xl tracking-widest uppercase text-white mb-10">
          Recuperar Senha
        </h1>

        {state.status === "success" ? (
          <div className="border border-zinc-800 p-6">
            <p className="text-sm text-zinc-400 tracking-wide mb-4">
              Se o e-mail estiver cadastrado, você receberá um link em breve.
            </p>
            <Link
              href="/login"
              className="text-xs tracking-widest uppercase text-zinc-500 hover:text-white transition-colors"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            {state.status === "error" && (
              <p className="text-xs tracking-wider text-red-500 border border-red-900 px-3 py-2">
                {state.message}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs tracking-[0.2em] uppercase text-zinc-500">
                E-mail
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="bg-transparent border border-zinc-700 px-3 py-2 text-sm tracking-wider text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="border border-zinc-600 py-2 text-xs tracking-widest uppercase text-zinc-400 hover:border-white hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              {pending ? "Enviando..." : "Enviar link"}
            </button>

            <Link
              href="/login"
              className="text-xs tracking-widest uppercase text-zinc-600 hover:text-zinc-400 transition-colors text-center"
            >
              Voltar
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
