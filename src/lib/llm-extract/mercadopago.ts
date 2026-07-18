// Mercado Pago extraction: only the 'Detalhes de consumo' transaction section
// is sent to the LLM — ported from banks/mercadopago.py.
import { extractTextPages } from "@/lib/importers/base";
import { callLlm, type LlmCorrection, type LlmTransaction } from "./base";

const PROMPT_HINT =
  "\n\nMercado Pago transaction lines format:\n" +
  "'DD/MM  MERCHANT  R$ 111,23' or 'DD/MM  MERCHANT  Parcela 2 de 3  R$ 111,23'.\n" +
  "Skip: 'Pagamento da fatura', 'Total R$' lines.";

export async function extract(
  pdfBytes: Buffer | Uint8Array,
  corrections: LlmCorrection[]
): Promise<[LlmTransaction[], string]> {
  const text = await transactionSection(pdfBytes);
  const txns = await callLlm(text, "Mercado Pago", { extraHint: PROMPT_HINT, maxTokens: 512, corrections });
  return [txns, text];
}

/** Extract only lines from 'Data Movimentações' header to 'Total R$'. */
export async function transactionSection(pdfBytes: Buffer | Uint8Array): Promise<string> {
  const pages = await extractTextPages(pdfBytes);
  const lines = pages.join("\n").split("\n");

  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (!inSection) {
      if (stripped.includes("Data") && stripped.includes("Movimenta")) inSection = true;
      continue;
    }
    if (stripped.startsWith("Total R$") || stripped.startsWith("Total R$")) break;
    if (stripped) result.push(stripped);
  }

  return result.join("\n");
}
