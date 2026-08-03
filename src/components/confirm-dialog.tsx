"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive-confirmation dialog. AlertDialog (not Dialog) is the right
 * primitive here: it focuses Cancel on open and deliberately does *not*
 * dismiss on outside click, so a stray click can't be read as "confirm".
 *
 * The manual cancelRef.focus() effect and the window-level Escape listener
 * this used to carry are both Radix's job now. The old listener was also a
 * live bug: it sat on `window` alongside ModalShell's, so one Escape closed
 * the confirm *and* the detail modal underneath it. Radix only arms the
 * topmost layer, so Escape now unwinds one dialog at a time.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "CONFIRMAR",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog.Root open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 flex items-center justify-center bg-black/50">
          <AlertDialog.Content
            className="bg-[#c8c8d0] dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-6 flex flex-col gap-5 w-full max-w-sm mx-4"
          >
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
                {title}
              </AlertDialog.Title>
              {description && (
                <AlertDialog.Description className="text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
                  {description}
                </AlertDialog.Description>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-xs tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                  Cancelar
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 text-xs tracking-widest uppercase border border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-white hover:border-zinc-900 dark:hover:border-white transition-colors cursor-pointer"
                >
                  {confirmLabel}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
