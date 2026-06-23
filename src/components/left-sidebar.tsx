"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPerson } from "@/lib/actions/person";
import type { PersonWithBalance } from "@/lib/actions/person";

interface Props {
  people: PersonWithBalance[];
}

export function LeftSidebar({ people }: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = query.trim()
    ? people.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.id.includes(query)
      )
    : people;

  function copyId(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="BUSCAR POR NOME OU ID"
          className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
        />
      </div>

      {/* People list */}
      <nav className="flex-1 overflow-y-auto min-h-0 py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-600">
            Nenhum resultado.
          </p>
        ) : (
          <ul>
            {filtered.map((person) => {
              const isActive = pathname === `/pessoa/${person.id}`;
              return (
                <li key={person.id} className="group relative">
                  <Link
                    href={`/pessoa/${person.id}`}
                    className={`flex items-baseline justify-between px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0 mr-2">
                      <span className="text-xs tracking-widest uppercase truncate">
                        {person.name}
                      </span>
                      {/* Copy ID button — visible on hover/active */}
                      <button
                        type="button"
                        onClick={(e) => copyId(e, person.id)}
                        title="Copiar ID"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 text-[9px] tracking-wider leading-none"
                      >
                        {copiedId === person.id ? "✓" : "ID"}
                      </button>
                    </span>
                    <span
                      className={`text-xs tracking-tight shrink-0 ${
                        person.totalOwed <= 0
                          ? "text-zinc-400 dark:text-zinc-600"
                          : "text-zinc-900 dark:text-zinc-200"
                      }`}
                    >
                      {person.totalOwed <= 0
                        ? "QUITADO"
                        : `R$ ${person.totalOwed.toFixed(2)}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Add person */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 shrink-0">
        <form action={createPerson} className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="NOVA PESSOA"
            required
            className="min-w-0 flex-1 bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="shrink-0 border border-zinc-400 dark:border-zinc-600 px-3 py-2 text-xs tracking-widest text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            +
          </button>
        </form>
      </div>
    </div>
  );
}
