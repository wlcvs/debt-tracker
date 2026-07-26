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

/**
 * For a dismissable nested inside another (an inline row-edit inside a modal, a
 * dropdown inside a panel): checking the inner dismissable's state from the outer
 * one's dismiss handler does NOT reliably work, for two independent reasons —
 * both fixed the same way, and BOTH outside-click and Escape need this guard:
 *
 * 1. Outside-click: clicking outside always fires `blur` on the focused input
 *    *before* the click event reaches the outer dismissable (browser event order:
 *    mousedown → blur → mouseup → click), so the inner state has already reset to
 *    "inactive" by the time the outer handler checks it.
 * 2. Escape: pressing Escape while editing calls the inner dismissable's own
 *    cancel (e.g. `setEditingIndex(null)`) directly in its onKeyDown. React flushes
 *    that state update and re-renders synchronously for this discrete event —
 *    including re-running the outer dismissable's own hooks — *before* the same
 *    native keydown event finishes bubbling to the `window`-level Escape listener
 *    this hook attaches. So the outer handler's closure has already been rebuilt
 *    with the inner state back at "inactive" by the time it runs, and wrongly
 *    concludes "no inner edit was active" — same wrong outcome as case 1, via a
 *    completely different mechanism (a synchronous render race, not blur or DOM
 *    removal). This one is easy to miss because it doesn't involve blur at all,
 *    which is why it's tempting (and wrong) to assume Escape doesn't need the guard.
 *
 * Call `suppressNext()` synchronously inside the inner dismissable's own commit/
 * cancel handler — its `onBlur` AND its `onKeyDown`'s Escape branch, both — then
 * wrap the outer dismissable's close logic in `guard(() => ...)`: the first outer
 * dismiss attempt after a suppress is swallowed once (the inner handler already
 * handled this gesture), and every one after that behaves normally.
 */
export function useDismissGuard() {
  const suppressedRef = useRef(false);
  function suppressNext() {
    suppressedRef.current = true;
  }
  function guard(fn: () => void) {
    if (suppressedRef.current) {
      suppressedRef.current = false;
      return;
    }
    fn();
  }
  return { suppressNext, guard };
}
