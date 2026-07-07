import * as nubank from "./nubank";
import * as itau from "./itau";
import * as mercadopago from "./mercadopago";
import * as bradesco from "./bradesco";
import { type Transaction, extractTextPages } from "./base";

export interface DetectResult {
  bank: string;
  transactions: Transaction[];
}

type ParseFn = (data: Buffer | Uint8Array) => Promise<Transaction[]>;

export async function detectAndParse(data: Buffer | Uint8Array): Promise<DetectResult> {
  const pages = await extractTextPages(data);
  const fullText = pages.join("\n").toLowerCase();

  // Nubank before Bradesco: Nubank statements mention "BCO BRADESCO S.A."
  // in transfer descriptions, causing false detection if Bradesco came first
  if (fullText.includes("nubank") || fullText.includes("nu pagamentos")) {
    return { bank: "Nubank", transactions: await nubank.parse(data) };
  }

  // "bradesco celular" is specific to the Bradesco app export;
  // plain "bradesco" can appear as a bank reference in other banks' statements
  if (fullText.includes("bradesco celular") || fullText.includes("banco bradesco")) {
    return { bank: "Bradesco", transactions: await bradesco.parse(data) };
  }

  if (fullText.includes("itaú") || fullText.includes("itau") || fullText.includes("banco itaú")) {
    return { bank: "Itaú", transactions: await itau.parse(data) };
  }

  if (fullText.includes("mercado pago") || fullText.includes("mercadopago")) {
    return { bank: "Mercado Pago", transactions: await mercadopago.parse(data) };
  }

  // Last resort: Bradesco statement without the "Celular" header
  if (fullText.includes("bradesco")) {
    return { bank: "Bradesco", transactions: await bradesco.parse(data) };
  }

  // Generic fallback — tries all parsers and returns the most results
  const candidates: [string, ParseFn][] = [
    ["Nubank", nubank.parse],
    ["Itaú", itau.parse],
    ["Mercado Pago", mercadopago.parse],
    ["Bradesco", bradesco.parse],
  ];

  const results: [string, Transaction[]][] = [];
  for (const [name, parseFn] of candidates) {
    try {
      results.push([name, await parseFn(data)]);
    } catch {
      // ignore — bank stays out of the fallback race
    }
  }

  if (results.length > 0) {
    const best = results.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    if (best[1].length > 0) {
      return { bank: `${best[0]} (detectado)`, transactions: best[1] };
    }
  }

  return { bank: "Desconhecido", transactions: [] };
}
