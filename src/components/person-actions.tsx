"use client";

import { useState } from "react";
import { deletePerson } from "@/lib/actions/person";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Props {
  person: { id: string; name: string };
}

export function PersonActions({ person }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-xs tracking-widest uppercase text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors cursor-pointer"
      >
        Excluir devedor
      </button>

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
    </>
  );
}
