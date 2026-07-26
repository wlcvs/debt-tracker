"use client";

import { deleteCreditCard } from "@/lib/actions/credit-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirmDelete } from "@/lib/hooks/use-confirm-delete";

interface CreditCard {
  id: string;
  label: string;
}

export function CreditCardList({ cards }: { cards: CreditCard[] }) {
  const { confirming, setConfirming, error, setError, confirmDelete } = useConfirmDelete<CreditCard>((card) => {
    const fd = new FormData();
    fd.append("id", card.id);
    return deleteCreditCard(fd);
  });

  return (
    <>
      {error && (
        <p className="text-xs tracking-wide text-red-500 mb-3">{error}</p>
      )}
      <ul className="flex flex-col mb-4">
        {cards.map((card) => (
          <li
            key={card.id}
            className="flex items-center justify-between text-xs tracking-widest uppercase py-2 border-b border-zinc-200 dark:border-zinc-900 text-zinc-600 dark:text-zinc-400"
          >
            <span>{card.label}</span>
            <button
              onClick={() => { setError(null); setConfirming(card); }}
              className="tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>

      {confirming && (
        <ConfirmDialog
          title={`Excluir ${confirming.label}?`}
          description="Esta ação não pode ser desfeita."
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirming(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
