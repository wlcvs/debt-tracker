import { z } from "zod";
import { parseAmountInput } from "@/lib/format-utils";

// Kept as a function (not a constant) so create-schemas can pass their
// explicit "Amount must be greater than zero" message while update-schemas
// call it with no message, exactly preserving Zod's own default message —
// don't collapse that distinction into one shared message everywhere.
//
// The preprocess step is load-bearing: amount fields are free text with
// inputMode="decimal", so a pt-BR keyboard hands us "685,91", which plain
// z.coerce.number() turns into NaN and rejects — silently, since a throwing
// Server Action just leaves the form sitting there. parseAmountInput is the
// single normalization for the whole app.
export const amountSchema = (message?: string) =>
  z.preprocess((v) => (typeof v === "string" ? parseAmountInput(v) : v), z.coerce.number().positive(message));

export const dateSchema = z.coerce.date();
