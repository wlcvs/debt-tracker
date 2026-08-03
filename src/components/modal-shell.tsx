"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface Props {
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  /** Default "max-w-sm" — override for wider panels (e.g. installment-group-panel's "max-w-md"). */
  maxWidthClassName?: string;
}

/**
 * Shared shell for the app's simple centered detail/panel modals: backdrop,
 * bordered panel, eyebrow/"Fechar" header.
 *
 * Content is nested *inside* Overlay rather than being its sibling, so the
 * backdrop's padding ring is a real "outside" region — that's what Radix's
 * onPointerDownOutside measures against. A full-screen Content would leave
 * nowhere to click outside and outside-dismiss would silently stop working.
 *
 * No z-index: stacking is settled by mount order alone. Dialog.Portal appends to
 * document.body, so a modal opened on top of another (installment-group-panel over
 * debt-detail-modal, ConfirmDialog over either) lands later in the body and paints
 * above, while Radix's layer stack routes Escape to the topmost one only. This
 * replaced a hand-maintained ladder (z-10/z-20/z-40/z-50/z-[1000]) and only holds
 * while nothing outside a portal claims an explicit z-index — the two deliberate
 * exceptions are transaction-table's sticky <thead> and manual-add-dialog's
 * overlay, both of which stack *within* a Content rather than against one.
 */
export function ModalShell({ eyebrow, onClose, children, maxWidthClassName = "max-w-sm" }: Props) {
  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Dialog.Content
            className={`relative bg-[#f0f0f4] dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <Dialog.Title className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 dark:text-zinc-500">
                {eyebrow}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
                  Fechar
                </button>
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
