"use client";

import { useState, useActionState } from "react";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(signInAction, { status: "idle" });

  const inputClass =
    "bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

  return (
    <form className="flex flex-col gap-4" action={action}>
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <input
        type="password"
        name="password"
        placeholder="SENHA"
        required
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
