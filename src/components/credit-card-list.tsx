"use client";

import { useState } from "react";
import { deleteCreditCard } from "@/lib/actions/credit-card";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface CreditCard {
  id: string;
  label: string;
}

export function CreditCardList({ cards }: { cards: CreditCard[] }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    try {
      await deleteCreditCard(fd);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir cartão.");
    }
    setConfirmId(null);
  }

  const confirmCard = cards.find((c) => c.id === confirmId);

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
              onClick={() => { setError(null); setConfirmId(card.id); }}
              className="text-zinc-400 dark:text-zinc-700 hover:text-red-500 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {confirmCard && (
        <ConfirmDialog
          title={`Excluir ${confirmCard.label}?`}
          description="Esta ação não pode ser desfeita."
          confirmLabel="EXCLUIR"
          onCancel={() => setConfirmId(null)}
          onConfirm={() => handleDelete(confirmCard.id)}
        />
      )}
    </>
  );
}
