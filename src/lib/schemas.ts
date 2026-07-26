import { z } from "zod";

// Kept as a function (not a constant) so create-schemas can pass their
// explicit "Amount must be greater than zero" message while update-schemas
// call it with no message, exactly preserving Zod's own default message —
// don't collapse that distinction into one shared message everywhere.
export const amountSchema = (message?: string) => z.coerce.number().positive(message);

export const dateSchema = z.coerce.date();
