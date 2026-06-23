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

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-1">
          Sistema
        </p>
        <h1 className="text-2xl tracking-widest uppercase text-white mb-10">
          Nova Senha
        </h1>

        {state.status === "success" ? (
          <div className="border border-zinc-800 p-6">
            <p className="text-sm text-zinc-400 tracking-wide mb-4">
              Senha redefinida com sucesso.
            </p>
            <Link
              href="/login"
              className="text-xs tracking-widest uppercase text-zinc-500 hover:text-white transition-colors"
            >
              Fazer login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state.status === "error" && (
              <p className="text-xs tracking-wider text-red-500 border border-red-900 px-3 py-2">
                {state.message}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs tracking-[0.2em] uppercase text-zinc-500">
                Nova senha
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="bg-transparent border border-zinc-700 px-3 py-2 text-sm tracking-wider text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
              />
              <p className="text-xs text-zinc-600">Mínimo 8 caracteres</p>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="border border-zinc-600 py-2 text-xs tracking-widest uppercase text-zinc-400 hover:border-white hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              {pending ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
