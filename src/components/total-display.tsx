"use client";

import { useState } from "react";

export function TotalDisplay({ total }: { total: number }) {
  const [hidden, setHidden] = useState(false);

  return (
    <section>
      <div className="flex items-center gap-8 mb-3">
        <p className="text-[10px] tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase">
          Total a receber
        </p>
        <button
          onClick={() => setHidden((h) => !h)}
          className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer py-3 -my-3 px-2 -mx-2"
        >
          {hidden ? "MOSTRAR" : "ESCONDER"}
        </button>
      </div>
      <p className="text-5xl tracking-tight text-zinc-900 dark:text-white">
        {hidden ? "R$ ••••••" : `R$ ${total.toFixed(2)}`}
      </p>
    </section>
  );
}
