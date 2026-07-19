import { type Transaction, parseBrAmount, parseBrDate, detectYear, extractTextPages } from "./base";

export const TX_RE = /^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s+([\d.,]+)$/;
export const YEAR_RE = /(?:Emitida em|Vence em|Vencimento)[:\s]+\d{2}\/\d{2}\/(\d{4})/;

export const SKIP = [
  "Pagamento da fatura",
  "Data Movimentações",
  "Movimentações na fatura",
  "Detalhes de consumo",
  "Total R$",
  "Cartão Visa",
  "Cartão Mastercard",
  "Cartão Elo",
];

export async function parse(data: Buffer | Uint8Array): Promise<Transaction[]> {
  const pagesText = await extractTextPages(data);
  const year = detectYear(pagesText, YEAR_RE);
  return parseText(pagesText, year);
}

function parseText(pagesText: string[], year: number): Transaction[] {
  const transactions: Transaction[] = [];

  for (const page of pagesText) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      if (SKIP.some((s) => line.includes(s))) continue;

      const m = line.match(TX_RE);
      if (!m) continue;

      const [, dateStr, descRaw, amountRaw] = m;
      const [dd, mm] = dateStr.split("/");
      const desc = descRaw.trim();
      const amount = parseBrAmount(amountRaw);

      if (amount !== null && amount > 0) {
        const date = parseBrDate(Number(dd), Number(mm), year);
        if (date) transactions.push({ date, description: desc, amount });
      }
    }
  }

  return transactions;
}
