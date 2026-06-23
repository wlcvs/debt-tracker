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
    <button
      onClick={toggle}
      title={dark ? "Modo claro" : "Modo escuro"}
      className="text-xs tracking-widest uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
