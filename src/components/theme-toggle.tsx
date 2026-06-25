"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs tracking-widest uppercase text-zinc-500">TEMA</span>
      <button
        onClick={toggle}
        title={dark ? "Modo claro" : "Modo escuro"}
        className="w-14 text-xs tracking-widest uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        {dark ? "CLARO" : "ESCURO"}
      </button>
    </div>
  );
}
