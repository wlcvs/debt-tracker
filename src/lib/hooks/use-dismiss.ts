"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface UseDismissOptions {
  /** Set to false to detach both listeners (e.g. while an inner dismissable — a nested
   * dropdown, an inline edit — should handle its own outside-click/Escape first). */
  enabled?: boolean;
  /** Set to false to skip the outside-click listener (e.g. a full-screen modal whose
   * backdrop already has its own onClick, so `ref` has no meaningful "outside"). */
  outsideClick?: boolean;
  /** Set to false to skip the Escape-key listener. */
  escape?: boolean;
  /** Set to true to attach the Escape listener in the capture phase and call
   * stopPropagation() when it fires. A plain bubble-phase listener (the default)
   * can't reliably beat another useDismiss consumer's own bubble-phase listener
   * on `window` — both are independent listeners on the same target, and which
   * fires first depends on attach order/timing, not DOM nesting. A capture-phase
   * listener on `window` always runs before any bubble-phase listener anywhere
   * (capture starts at `window` and works down to the target, before bubbling
   * back up), so stopping propagation there reliably lets a nested dismissable
   * (e.g. a dropdown inside a form that has its own useDismiss) consume Escape
   * for itself without it also reaching the outer one. Only meaningful when
   * `escape` is true. */
  escapeCapture?: boolean;
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
  { enabled = true, outsideClick = true, escape = true, escapeCapture = false }: UseDismissOptions = {},
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!enabled) return;

    function onClickOutside(e: MouseEvent) {
      // Stand down while a Radix layer that disables outside pointer events is
      // open (Select, Dialog, …). Such a layer sets body { pointer-events: none }
      // and takes pointer-events: auto for itself, so a click on its portalled
      // content — or anywhere else on the page — hit-tests to <html> rather than
      // to anything inside `ref`. This hook would then read a click that belongs
      // to that layer as "outside" and dismiss: picking an option from a
      // MethodSelect would reset the create-debt form around it. The layer owns
      // that gesture and dismisses itself; a second click reaches us normally.
      if (document.body.style.pointerEvents === "none") return;

      // Uses composedPath() (the path captured at dispatch time), not e.target —
      // a nested dismissable that removes its own DOM node as a side effect of the
      // click that selects it (e.g. a dropdown closing when an option is chosen)
      // leaves e.target detached from the document by the time this listener runs,
      // so ref.contains(e.target) would wrongly read as "outside" even though the
      // click originated inside ref's subtree.
      if (ref?.current && !e.composedPath().includes(ref.current)) {
        onDismissRef.current();
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // A Radix DismissableLayer that consumed this Escape marks it handled via
      // preventDefault() (it deliberately does not stopPropagation, so the event
      // still reaches this window-level listener). Without this check, dismissing
      // a MethodSelect dropdown would also reset the create-debt form around it —
      // the regression method-select.spec.ts guards.
      if (e.defaultPrevented) return;
      if (escapeCapture) e.stopPropagation();
      onDismissRef.current();
    }

    if (outsideClick && ref) document.addEventListener("click", onClickOutside);
    if (escape) window.addEventListener("keydown", onEscape, escapeCapture);
    return () => {
      if (outsideClick && ref) document.removeEventListener("click", onClickOutside);
      if (escape) window.removeEventListener("keydown", onEscape, escapeCapture);
    };
  }, [ref, enabled, outsideClick, escape, escapeCapture]);
}
