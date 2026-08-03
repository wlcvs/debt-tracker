"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Tells a Radix Dialog whether the outside-click it is about to act on was the
 * same gesture that ended an inline edit inside it (a rename input, an editable
 * table cell), so it can decline to close and let the edit's own blur handler
 * commit in peace.
 *
 * Why this is needed at all: `@radix-ui/react-dialog` hardcodes
 * `deferPointerDownOutside: true` on its DismissableLayer — and does it *after*
 * spreading the caller's props, so `Dialog.Content` cannot opt out. For a
 * left-click that means Radix defers the dismiss decision from `pointerdown` to
 * `click`, which lands after the browser has already fired `blur` on the input.
 * By the time `onInteractOutside` runs, the inline edit has committed and reset
 * its own state, so reading that state there always reports "no edit active"
 * and the modal closes when it shouldn't. Observed order:
 *
 *   pointerdown → mousedown → blur (edit commits, state clears) → mouseup → click → onInteractOutside
 *
 * `pointerdown` does precede `blur`, so a snapshot taken there is the honest
 * answer to "was an edit in progress when this gesture started?". The listener
 * is in the capture phase so it runs before any handler that might end the edit
 * early.
 *
 * Escape does NOT need this: Radix listens for it on `document` in the capture
 * phase and only on the topmost layer, so `onEscapeKeyDown` genuinely runs
 * before the input's own `onKeyDown`. Read the edit state directly there.
 *
 * This replaces `useDismissGuard`'s `suppressNext()`, which required every
 * inline edit to remember to call it from both `onBlur` and the Escape branch
 * of `onKeyDown` — a rule that was broken more than once. The knowledge now
 * lives entirely in the modal; inline edits stay plain.
 *
 * @param active whether an inline edit is currently in progress
 * @returns a ref holding whether one was in progress at the last pointerdown
 */
export function useInlineEditGuard(active: boolean): RefObject<boolean> {
  const activeRef = useRef(active);
  const wasActiveAtGestureStart = useRef(false);

  // Mirrored in an effect rather than assigned during render (same pattern as
  // use-dismiss.ts), so the listener below can stay mounted once and still read
  // a current value.
  useEffect(() => {
    activeRef.current = active;
  });

  useEffect(() => {
    function onPointerDown() {
      wasActiveAtGestureStart.current = activeRef.current;
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return wasActiveAtGestureStart;
}
