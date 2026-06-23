"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import Link from "next/link";
import { Suspense } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailFromLogin = searchParams.get("email") ?? "";

  const [state, action, pending] = useActionState(requestPasswordReset, {
    status: "idle",
  });
  const [clientError, setClientError] = useState("");

  const inputClass =
    "bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

  const errorClass =
    "text-xs tracking-wider text-red-500 border border-red-200 dark:border-red-900 px-3 py-2";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value.trim();
    if (!EMAIL_RE.test(email)) {
      e.preventDefault();
      setClientError("Digite um e-mail válido (ex: nome@dominio.com).");
      return;
    }
    setClientError("");
  }

  return (
    <>
      {state.status === "success" ? (
        <div className="border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 tracking-wide mb-4">
            Link de redefinição enviado. Verifique sua caixa de entrada.
          </p>
          <Link
            href="/login"
            className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
          {clientError && <p className={errorClass}>{clientError}</p>}
          {state.status === "error" && !clientError && (
            <p className={errorClass}>{state.message}</p>
          )}

          <input
            type="text"
            inputMode="email"
            name="email"
            placeholder="E-MAIL"
            required
            autoComplete="email"
            defaultValue={emailFromLogin}
            onChange={() => setClientError("")}
            className={inputClass}
          />

          <button
            type="submit"
            disabled={pending}
            className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            {pending ? "Enviando..." : "Enviar link"}
          </button>

          <Link
            href="/login"
            className="text-center text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors"
          >
            Voltar ao login
          </Link>
        </form>
      )}
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Recuperar Senha
          </h1>
        </div>
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
