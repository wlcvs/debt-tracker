"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({ sidebar, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#e8e8ed] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white dark:bg-zinc-950 border-r border-zinc-300 dark:border-zinc-800 overflow-hidden">
        {sidebar}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="relative z-50 flex flex-col w-72 h-full bg-white dark:bg-zinc-950 border-r border-zinc-300 dark:border-zinc-800 overflow-hidden">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm cursor-pointer"
            >
              ✕
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-300 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-lg leading-none"
          >
            ☰
          </button>
          <Link href="/" className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
            Debt Tracker
          </Link>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
