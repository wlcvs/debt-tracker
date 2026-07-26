"use client";

import { useState } from "react";

/**
 * Shared "click Excluir -> confirm in a ConfirmDialog -> call a delete
 * action" wiring, previously hand-rolled slightly differently in 5
 * components (credit-card-list.tsx, payment-detail-modal.tsx,
 * debt-detail-modal.tsx, person-actions.tsx, statements-modal.tsx).
 * Takes the item directly (not a pre-built FormData) so each call site's
 * own closure decides what the underlying action needs — some actions take
 * FormData, statement.ts's deleteStatement takes a plain id, and
 * debt-detail-modal.tsx branches between two different delete actions.
 */
export function useConfirmDelete<T>(onDelete: (item: T) => Promise<void>, onSuccess?: () => void) {
  const [confirming, setConfirming] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!confirming) return;
    try {
      await onDelete(confirming);
      setError(null);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir.");
    }
    setConfirming(null);
  }

  return { confirming, setConfirming, error, setError, confirmDelete };
}
