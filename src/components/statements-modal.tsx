"use client";

import { useEffect, useRef, useState } from "react";
import { getStatements, deleteStatement, type StatementSummary } from "@/lib/actions/statement";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateBR } from "@/lib/date-utils";

interface Props {
  onClose: () => void;
  onImportNew: () => void;
  onReopen: (id: string) => void;
}

export function StatementsModal({ onClose, onImportNew, onReopen }: Props) {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<StatementSummary | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStatements().then(setStatements);
  }, []);

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  async function handleDelete(id: string) {
    await deleteStatement(id);
    setStatements((prev) => prev.filter((s) => s.id !== id));
    setConfirmDelete(null);
  }

  const filtered = statements.filter((s) => {
    const filename = s.filename.toLowerCase();
    const date = new Date(s.uploadedAt).toISOString().slice(0, 10);
    if (search.trim() && !filename.includes(search.trim().toLowerCase())) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex flex-col bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-2xl max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Extratos salvos</p>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            ✕
          </button>
        </div>

        <div ref={wrapperRef} className="border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex gap-3 px-6 py-3">
            <button
              onClick={onImportNew}
              className="shrink-0 border border-zinc-400 dark:border-zinc-600 px-4 py-2 text-[10px] tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              + Importar
            </button>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome do arquivo…"
              className="flex-1 min-w-0 truncate bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`shrink-0 text-[10px] tracking-widest uppercase border px-3 py-2 transition-colors whitespace-nowrap cursor-pointer ${
                showFilters || dateFrom || dateTo
                  ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-600 dark:hover:border-zinc-400"
              }`}
            >
              Filtros
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-2 px-6 pb-3">
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">De</p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Até</p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="self-end text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors px-1 py-1.5"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-xs text-zinc-400 dark:text-zinc-600 text-center">Nenhum extrato salvo ainda.</p>
          ) : (
            filtered.map((stmt) => (
              <div key={stmt.id} className="flex items-center gap-4 px-6 py-3.5">
                <button
                  onClick={() => onReopen(stmt.id)}
                  className="flex-1 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white truncate min-w-0 text-left transition-colors cursor-pointer"
                >
                  {stmt.filename}
                </button>
                <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                  {formatDateBR(new Date(stmt.uploadedAt))}
                </span>
                <button
                  onClick={() => onReopen(stmt.id)}
                  className="text-[10px] tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  Abrir
                </button>
                <button
                  onClick={() => setConfirmDelete(stmt)}
                  className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir extrato?"
          description={`${confirmDelete.filename} será removido permanentemente.`}
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
        />
      )}
    </div>
  );
}
