"use client";

import { useEffect } from "react";

type FieldWithError = (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) & {
  _errEl?: HTMLParagraphElement | null;
};

// Replaces the browser's native validation tooltip with a styled inline
// message, matching every field across the app instead of relying on
// per-form error state.
export function FormValidationMessages() {
  useEffect(() => {
    function onInvalid(e: Event) {
      e.preventDefault();
      const el = e.target as FieldWithError;
      if (!el.validity) return;

      if (!el._errEl || !el._errEl.isConnected) {
        const err = document.createElement("p");
        err.className = "field-error text-xs text-red-500 mt-1 tracking-wide";
        el.insertAdjacentElement("afterend", err);
        el._errEl = err;
      }

      el._errEl.textContent = el.validity.valueMissing
        ? "Campo obrigatório"
        : el.validity.typeMismatch
          ? "Formato inválido"
          : el.validity.tooShort
            ? "Muito curto"
            : "Valor inválido";
    }

    function onInput(e: Event) {
      const el = e.target as FieldWithError;
      if (el._errEl && el.validity?.valid) el._errEl.textContent = "";
    }

    function onFocusOut(e: FocusEvent) {
      const el = e.target as FieldWithError;
      if (el._errEl) {
        el._errEl.remove();
        el._errEl = null;
      }
      const form = (el as HTMLElement).closest?.("form");
      if (form && !form.contains(e.relatedTarget as Node)) {
        form.querySelectorAll(".field-error").forEach((err) => err.remove());
        form.querySelectorAll("input, select, textarea").forEach((i) => {
          (i as FieldWithError)._errEl = null;
        });
      }
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, select, textarea")) return;
      document.querySelectorAll(".field-error").forEach((err) => err.remove());
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        (el as FieldWithError)._errEl = null;
      });
    }

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
