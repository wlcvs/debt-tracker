"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Collapsible from "@radix-ui/react-collapsible";
import { getStatements, deleteStatement, renameStatement, type StatementSummary } from "@/lib/actions/statement";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateBR, toDateInputValue, DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-utils";
import { useDismiss } from "@/lib/hooks/use-dismiss";
import { useInlineEditGuard } from "@/lib/hooks/use-inline-edit-guard";
import { useConfirmDelete } from "@/lib/hooks/use-confirm-delete";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStatements().then(setStatements);
  }, []);

  useDismiss(wrapperRef, () => setShowFilters(false), { escape: false });

  const renamingAtGestureStart = useInlineEditGuard(editingId !== null);

  const {
    confirming: confirmDelete,
    setConfirming: setConfirmDelete,
    confirmDelete: performDelete,
  } = useConfirmDelete<StatementSummary>(async (s) => {
    await deleteStatement(s.id);
    setStatements((prev) => prev.filter((x) => x.id !== s.id));
  });

  function startEditing(stmt: StatementSummary) {
    setEditingId(stmt.id);
    setEditValue(stmt.filename);
  }

  async function commitEdit(id: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    const original = statements.find((s) => s.id === id)?.filename;
    if (!trimmed || trimmed === original) return;
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, filename: trimmed } : s)));
    await renameStatement(id, trimmed);
  }

  const filtered = statements.filter((s) => {
    const filename = s.filename.toLowerCase();
    const date = toDateInputValue(new Date(s.uploadedAt));
    if (search.trim() && !filename.includes(search.trim().toLowerCase())) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });

  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Dialog.Content
            // Escape can read editingId directly: Radix listens for it on document
            // in the capture phase, and only on the topmost layer, so this runs
            // before the rename input's own onKeyDown clears the state.
            onEscapeKeyDown={(e) => { if (editingId) e.preventDefault(); }}
            // Outside-click can NOT: Dialog forces deferPointerDownOutside, so this
            // fires at click time, after blur has already committed the rename and
            // reset editingId. See use-inline-edit-guard.ts for the full ordering.
            onInteractOutside={(e) => { if (renamingAtGestureStart.current) e.preventDefault(); }}
            className="relative flex flex-col bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full max-w-2xl max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <Dialog.Title className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">Extratos salvos</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
                  Fechar
                </button>
              </Dialog.Close>
            </div>

            <Collapsible.Root open={showFilters} onOpenChange={setShowFilters} ref={wrapperRef} className="border-b border-zinc-200 dark:border-zinc-800 shrink-0">
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
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    className={`shrink-0 text-[10px] tracking-widest uppercase border px-3 py-2 transition-colors whitespace-nowrap cursor-pointer ${
                      showFilters || dateFrom || dateTo
                        ? "border-zinc-600 dark:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-600 dark:hover:border-zinc-400"
                    }`}
                  >
                    Filtros
                  </button>
                </Collapsible.Trigger>
              </div>

              <Collapsible.Content>
                <div className="flex gap-2 px-6 pb-3">
                  <div className="flex-1">
                    <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">De</p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
                      className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Até</p>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={DATE_INPUT_MIN}
                      max={DATE_INPUT_MAX}
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
              </Collapsible.Content>
            </Collapsible.Root>

            <div className="flex-1 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <p className="px-6 py-10 text-xs text-zinc-400 dark:text-zinc-600 text-center">Nenhum extrato salvo ainda.</p>
              ) : (
                filtered.map((stmt) => (
                  <div key={stmt.id} className="flex items-center gap-4 px-6 py-3.5">
                    {editingId === stmt.id ? (
                      <input
                        ref={editInputRef}
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(stmt.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-transparent border-b border-zinc-400 dark:border-zinc-500 px-0 py-0 text-xs text-zinc-900 dark:text-white focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onReopen(stmt.id)}
                        className="flex-1 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white truncate min-w-0 text-left transition-colors cursor-pointer"
                      >
                        {stmt.filename}
                      </button>
                    )}
                    <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                      {formatDateBR(new Date(stmt.uploadedAt))}
                    </span>
                    <button
                      onClick={() => startEditing(stmt)}
                      className="text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                    >
                      Renomear
                    </button>
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

            {/* Rendered inside Content, not beside it: Radix decides "inside" from the
                React tree, not the DOM, so keeping this a descendant is what stops a
                click on the confirmation (portaled to body) from reading as an outside
                click on this modal. It still paints on top — its own portal mounts later. */}
            {confirmDelete && (
              <ConfirmDialog
                title="Excluir extrato?"
                description={`${confirmDelete.filename} será removido permanentemente.`}
                confirmLabel="EXCLUIR"
                onCancel={() => setConfirmDelete(null)}
                onConfirm={performDelete}
              />
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
