"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseDismissOptions {
  /** Set to false to detach both listeners (e.g. while an inner dismissable — a nested
   * dropdown, an inline edit — should handle its own outside-click/Escape first). */
  enabled?: boolean;
  /** Set to false to skip the outside-click listener (e.g. a full-screen modal whose
   * backdrop already has its own onClick, so `ref` has no meaningful "outside"). */
  outsideClick?: boolean;
  /** Set to false to skip the Escape-key listener. */
  escape?: boolean;
}

/**
 * Calls `onDismiss` when the user clicks outside `ref`'s element or presses Escape.
 * Used for dropdowns, inline edit panels, and modals that should close/cancel on the
 * same two triggers. When nesting one dismissable inside another (e.g. an inline edit
 * inside a modal), disable the outer one via `enabled` while the inner one is active,
 * so a click/Escape meant for the inner dismissable doesn't also fire the outer one.
 *
 * Keeps `onDismiss` in a ref updated every render rather than as an effect dependency,
 * so the listeners are only (re)attached when `ref`/`enabled`/`outsideClick`/`escape`
 * change — never stale, and never needlessly torn down and rebuilt on every state
 * change the caller's `onDismiss` closes over.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null> | null,
  onDismiss: () => void,
  { enabled = true, outsideClick = true, escape = true }: UseDismissOptions = {},
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!enabled) return;

    function onClickOutside(e: MouseEvent) {
      if (ref?.current && !ref.current.contains(e.target as Node)) {
        onDismissRef.current();
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onDismissRef.current();
    }

    if (outsideClick && ref) document.addEventListener("click", onClickOutside);
    if (escape) window.addEventListener("keydown", onEscape);
    return () => {
      if (outsideClick && ref) document.removeEventListener("click", onClickOutside);
      if (escape) window.removeEventListener("keydown", onEscape);
    };
  }, [ref, enabled, outsideClick, escape]);
}
