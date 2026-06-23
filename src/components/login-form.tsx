"use client";

import { useState } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");

  const forgotHref = email.trim()
    ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
    : "/forgot-password";

  return (
    <>
      <form className="flex flex-col gap-4" action={signInAction}>
        <input
          type="email"
          name="email"
          placeholder="E-MAIL"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
        />
        <input
          type="password"
          name="password"
          placeholder="SENHA"
          required
          className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
        />
        <button
          type="submit"
          className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer mt-2"
        >
          Entrar
        </button>
      </form>

      <Link
        href={forgotHref}
        className="block text-center text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors mt-6"
      >
        Esqueceu a senha?
      </Link>
    </>
  );
}
