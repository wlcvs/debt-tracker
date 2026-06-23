"use client";

import { useState } from "react";
import { deletePerson, updatePerson } from "@/lib/actions/person";

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
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <form
          action={async (fd) => { await updatePerson(fd); setEditing(false); }}
          className="flex items-center gap-2 flex-1"
        >
          <input type="hidden" name="id" value={person.id} />
          <input
            type="text"
            name="name"
            defaultValue={person.name}
            required
            autoFocus
            className="bg-transparent border border-zinc-600 px-2 py-1 text-sm tracking-widest uppercase text-white focus:outline-none focus:border-white"
          />
          <button
            type="submit"
            className="text-xs tracking-widest uppercase text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs tracking-widest uppercase text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </form>
        <p className="text-lg tracking-tight text-white shrink-0">
          R$ {person.totalOwed.toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between px-5 py-4 border-b border-zinc-800">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm tracking-widest uppercase text-white">
          {person.name}
        </h2>
        {person.totalOwed <= 0 && (
          <span className="text-xs tracking-widest text-zinc-500">QUITADO</span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer"
          title="Renomear"
        >
          ✎
        </button>
        <form action={deletePerson}>
          <input type="hidden" name="id" value={person.id} />
          <button
            type="submit"
            className="text-xs text-zinc-700 hover:text-red-500 transition-colors cursor-pointer"
            title="Remover pessoa"
          >
            ✕
          </button>
        </form>
      </div>
      <p className="text-lg tracking-tight text-white">
        R$ {person.totalOwed.toFixed(2)}
      </p>
    </div>
  );
}
