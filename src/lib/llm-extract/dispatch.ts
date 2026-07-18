// LLM-based extraction dispatch — ported from banks/__init__.py. The bank is
// already detected once per import by src/lib/importers' detectAndParse and
// passed in as a hint; this only routes to the matching bank module (falling
// back to a generic full-text extraction for anything unrecognized).
import { extractTextPages } from "@/lib/importers/base";
import type { LlmCorrection, LlmTransaction } from "./base";
import { extractGeneric } from "./base";
import * as itau from "./itau";
import * as nubank from "./nubank";
import * as bradesco from "./bradesco";
import * as mercadopago from "./mercadopago";

export type { LlmCorrection, LlmTransaction } from "./base";

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  bank: string,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  if (bank.startsWith("Itaú") || bank.startsWith("Itau")) {
    return itau.extract(pdfBytes, corrections);
  }
  if (bank.startsWith("Nubank")) {
    return nubank.extract(pdfBytes, corrections);
  }
  if (bank.startsWith("Bradesco")) {
    return bradesco.extract(pdfBytes, corrections);
  }
  if (bank.startsWith("Mercado Pago")) {
    return mercadopago.extract(pdfBytes, corrections);
  }

  const pages = await extractTextPages(pdfBytes);
  return extractGeneric(pages.join("\n"), bank, corrections);
}
