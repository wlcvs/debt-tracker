"use client";

import { useState } from "react";

interface Props {
  accessCode: string;
}

export function ShareButton({ accessCode }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/consultar/${accessCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white px-3 py-1.5 transition-colors cursor-pointer"
    >
      {copied ? "COPIADO ✓" : "COMPARTILHAR"}
    </button>
  );
}
