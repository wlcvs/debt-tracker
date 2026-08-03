"use client";

import { useRouter } from "next/navigation";
import { deletePerson } from "@/lib/actions/person";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirmDelete } from "@/lib/hooks/use-confirm-delete";

interface Props {
  person: { accessCode: string; name: string };
}

export function PersonActions({ person }: Props) {
  const router = useRouter();
  const { confirming, setConfirming, confirmDelete } = useConfirmDelete<{ accessCode: string; name: string }>(
    (p) => {
      const fd = new FormData();
      fd.append("accessCode", p.accessCode);
      return deletePerson(fd);
    },
    () => router.push("/")
  );

  return (
    <>
      <button
        onClick={() => setConfirming(person)}
        className="text-xs tracking-widest uppercase text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors cursor-pointer"
      >
        Excluir devedor
      </button>

      {confirming && (
        <ConfirmDialog
          title={`Excluir ${confirming.name}?`}
          description="Esta ação não pode ser desfeita. Todas as dívidas e pagamentos serão removidos."
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
