"use client";

import { useState } from "react";
import { createCreditCard } from "@/lib/actions/credit-card";

const inputClass =
  "flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors";

export function CreateCreditCardForm() {
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col gap-1">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!fd.get("label")?.toString().trim()) {
            setError("Informe o nome do cartão.");
            return;
          }
          await createCreditCard(fd);
          e.currentTarget.reset();
          setError("");
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          name="label"
          placeholder="EX: NUBANK"
          className={inputClass}
          onChange={(e) => e.target.value.trim() && setError("")}
        />
        <button
          type="submit"
          className="border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-xs tracking-widest text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          +
        </button>
      </form>
      {error && <p className="text-[10px] tracking-wide text-red-500">{error}</p>}
    </div>
  );
}
