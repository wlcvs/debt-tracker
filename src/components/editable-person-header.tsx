"use client";

import { useState } from "react";
import { updatePerson } from "@/lib/actions/person";

interface Props {
  person: {
    id: string;
    name: string;
    totalOwed: number;
  };
}

export function EditablePersonHeader({ person }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex items-start justify-between gap-4">
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
        <p className="text-xl tracking-tight text-zinc-900 dark:text-white shrink-0">
          R$ {person.totalOwed.toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <h2
        onClick={() => setEditing(true)}
        className="text-lg tracking-widest uppercase text-zinc-900 dark:text-white cursor-pointer hover:opacity-60 transition-opacity"
        title="Clique para editar"
      >
        {person.name}
      </h2>
      <p className="text-xl tracking-tight text-zinc-900 dark:text-white shrink-0">
        R$ {person.totalOwed.toFixed(2)}
      </p>
    </div>
  );
}
