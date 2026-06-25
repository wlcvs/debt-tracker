"use client";

import { useState } from "react";
import { deletePerson, updatePerson } from "@/lib/actions/person";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Props {
  person: {
    id: string;
    name: string;
    totalOwed: number;
  };
}

export function EditablePersonHeader({ person }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 flex-1">
        <form
          action={async (fd) => { await updatePerson(fd); setEditing(false); }}
          className="flex items-center gap-2 flex-wrap"
        >
          <input type="hidden" name="id" value={person.id} />
          <input
            type="text"
            name="name"
            defaultValue={person.name}
            required
            autoFocus
            placeholder="NOME"
            className="bg-transparent border border-zinc-400 dark:border-zinc-600 px-2 py-1 text-sm tracking-widest uppercase text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-700 dark:focus:border-white"
          />
          <button type="submit" className="text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            Salvar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer">
            Cancelar
          </button>
        </form>
        <p className="text-xl tracking-tight text-zinc-900 dark:text-white">
          R$ {person.totalOwed.toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-1">
      <h2 className="text-lg tracking-widest uppercase text-zinc-900 dark:text-white">
        {person.name}
      </h2>
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-xl tracking-tight text-zinc-900 dark:text-white">
          R$ {person.totalOwed.toFixed(2)}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-pointer"
          title="Renomear"
        >
          ✎
        </button>
        <button
          onClick={() => setConfirming(true)}
          className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors cursor-pointer"
          title="Excluir pessoa"
        >
          ✕
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Excluir ${person.name}?`}
          description="Esta ação não pode ser desfeita. Todas as dívidas e pagamentos serão removidos."
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.append("id", person.id);
            await deletePerson(fd);
          }}
        />
      )}
    </div>
  );
}
