import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom implements neither the Pointer Capture API nor scrollIntoView, and
// Radix's Select calls all three while opening its listbox — without these it
// throws "target.hasPointerCapture is not a function" mid-render. Harmless
// no-ops: the assertions are about roles and form values, not pointer capture.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// Same class of gap: jsdom has no ResizeObserver, and Radix's Checkbox measures its
// own root (via use-size) to size the hidden input it bubbles form state through.
// A stub that never reports is enough — nothing under test asserts on that input.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
});
