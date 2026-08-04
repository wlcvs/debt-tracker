"use client";

import { I18nProvider } from "react-aria-components";

/**
 * Pins every react-aria date/number formatting to pt-BR.
 *
 * This is the whole reason `DateField` replaced `<input type="date">`: Chrome
 * renders a native date input in the *browser's* UI language, ignoring the
 * page's `lang` attribute, so a browser set to English showed mm/dd/yyyy in a
 * Brazilian app with no way to override it from HTML or CSS. react-aria reads
 * its locale from this provider instead, so the app decides.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return <I18nProvider locale="pt-BR">{children}</I18nProvider>;
}
