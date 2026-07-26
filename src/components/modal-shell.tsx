"use client";

import type { ReactNode } from "react";
import { useDismiss } from "@/lib/hooks/use-dismiss";

interface Props {
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  /** Default "max-w-sm" — override for wider panels (e.g. installment-group-panel's "max-w-md"). */
  maxWidthClassName?: string;
  /** Default "z-40" — override when this modal must stack above another already-open modal
   * (e.g. installment-group-panel opens on top of debt-detail-modal, which stays mounted
   * behind it, so it needs "z-50"). */
  zIndexClassName?: string;
}

/**
 * Shared shell for the app's simple centered detail/panel modals: backdrop,
 * bordered panel, eyebrow/"Fechar" header. Escape is wired via useDismiss
 * (consistent with every other dismissable in the app); outside-click stays
 * on the backdrop's own onClick rather than useDismiss's ref-based listener,
 * so it isn't wired twice.
 *
 * Not used by statements-modal.tsx or import-modal.tsx — both have a
 * genuinely different shell (different backdrop opacity, non-centered/
 * scrollable layout) and an existing useDismissGuard wiring for a nested
 * inline edit; forcing them into this shape would either warp it or risk
 * that already-hard-won guard behavior.
 */
export function ModalShell({ eyebrow, onClose, children, maxWidthClassName = "max-w-sm", zIndexClassName = "z-40" }: Props) {
  useDismiss(null, onClose, { outsideClick: false });

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">{eyebrow}</p>
          <button onClick={onClose} className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
