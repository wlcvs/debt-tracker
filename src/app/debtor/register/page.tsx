"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { debtorRegisterAction } from "@/lib/actions/debtor-auth";
import { ThemeToggle } from "@/components/theme-toggle";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "FRACA", color: "bg-red-500" };
  if (score <= 2) return { score, label: "RAZOÁVEL", color: "bg-yellow-500" };
  if (score <= 3) return { score, label: "BOA", color: "bg-blue-500" };
  return { score, label: "FORTE", color: "bg-green-500" };
}

const inputClass =
  "bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

function RegisterForm() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");

  const [state, action, pending] = useActionState(debtorRegisterAction, { status: "idle" });
  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/debtor/login?registered=1");
    }
  }, [state.status, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "error" && (
        <p className="text-xs tracking-wider text-red-500 border border-red-200 dark:border-red-900 px-3 py-2">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500">
          Código de acesso
        </label>
        <input
          type="text"
          name="accessCode"
          placeholder="CÓDIGO FORNECIDO PELO CREDOR"
          required
          defaultValue={codeFromUrl}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500">
          E-mail
        </label>
        <input
          type="text"
          inputMode="email"
          name="email"
          placeholder="SEU E-MAIL"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500">
          Celular
        </label>
        <input
          type="tel"
          name="phone"
          placeholder="(11) 99999-9999"
          required
          autoComplete="tel"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500">
          Senha
        </label>
        <input
          type="password"
          name="password"
          placeholder="MÍN. 8 CARACTERES"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {password.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-0.5 flex-1 transition-colors ${strength.score >= i ? strength.color : "bg-zinc-200 dark:bg-zinc-800"}`}
                />
              ))}
            </div>
            <p className="text-[10px] tracking-widest text-zinc-400 dark:text-zinc-600">
              {strength.label}
              {strength.score <= 2 && (
                <span className="ml-2 text-zinc-300 dark:text-zinc-700">
                  USE MAIÚSCULAS, NÚMEROS E SÍMBOLOS
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer group mt-1">
        <input
          type="checkbox"
          name="emailNotifications"
          defaultChecked={false}
          className="mt-0.5 accent-zinc-700 dark:accent-zinc-300 cursor-pointer"
        />
        <span className="text-xs tracking-wide text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Quero receber notificações por e-mail quando novas dívidas ou pagamentos forem registrados.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer mt-2 disabled:opacity-40"
      >
        {pending ? "..." : "Criar conta"}
      </button>
    </form>
  );
}

export default function DebtorRegisterPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
              Primeiro acesso
            </p>
            <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
              Cadastro
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Suspense>
          <RegisterForm />
        </Suspense>

        <div className="mt-8 text-center">
          <Link
            href="/debtor/login"
            className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors"
          >
            Já tem conta? Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
