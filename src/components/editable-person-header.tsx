"use client";

import { useRef, useState } from "react";
import { updatePerson } from "@/lib/actions/person";
import { useDismiss } from "@/lib/hooks/use-dismiss";

interface Props {
  person: {
    accessCode: string;
    name: string;
  };
}

// Just the name and its inline rename. The balance summary used to share this
// row; it lives under the month carousel now, since it reports that month's
// totals (see person-detail-view.tsx).
export function EditablePersonHeader({ person }: Props) {
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useDismiss(formRef, () => setEditing(false), { enabled: editing });

  if (editing) {
    return (
      <form
        ref={formRef}
        action={async (fd) => { await updatePerson(fd); setEditing(false); }}
        className="flex items-center gap-2 flex-wrap"
      >
        <input type="hidden" name="accessCode" value={person.accessCode} />
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
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      className="text-lg tracking-widest uppercase text-zinc-900 dark:text-white cursor-pointer hover:opacity-60 transition-opacity self-start"
      title="Clique para editar"
    >
      {person.name}
    </h2>
  );
}
