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
 * Stacking among portaled modals is settled by mount order alone: Dialog.Portal
 * appends to document.body, so one opened on top of another (installment-group-panel
 * over debt-detail-modal, ConfirmDialog over either) comes later in the body and
 * therefore paints above — and Radix's layer stack routes Escape to the topmost
 * one only. The `z-50` here is *not* part of that; it's a temporary tie-breaker
 * against statements-modal/import-modal, which are still hand-rolled `fixed z-50`
 * nodes rendered in place. z-index only competes between positioned elements, so
 * without it a legacy z-50 modal would paint over a portaled ConfirmDialog opened
 * from inside it. Matching their value keeps DOM order (portal last = on top) the
 * deciding factor. Delete it once those two are migrated and no z-index remains
 * outside a portal.
 */
export function ModalShell({ eyebrow, onClose, children, maxWidthClassName = "max-w-sm" }: Props) {
  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
