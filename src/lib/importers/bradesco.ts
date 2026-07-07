import { type Transaction, AMOUNT_RE, findAllAmounts, parseBrAmount, parseBrDate, extractTextPages } from "./base";

const DATE_LINE_RE = /^(\d{2}\/\d{2}\/\d{4})(.*)/;
const SKIP_STARTS = ["Bradesco ", "Data Histórico", "Nome:", "Total ", "Extrato de:", "Data:"];
const SKIP_CONTAINS = ["Movimentação entre"];
const DETAIL_STARTS = ["CONTR ", "Folha:"];

interface PendingTxn {
  date: string;
  desc: string;
  base: string;
  amount: number;
}

export async function parse(data: Buffer | Uint8Array): Promise<Transaction[]> {
  const pagesText = await extractTextPages(data);
  return parseText(pagesText);
}

function parseText(pagesText: string[]): Transaction[] {
  const txns: PendingTxn[] = [];
  let currentDate: string | null = null;
  let pendingType = "";

  for (const page of pagesText) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      if (SKIP_STARTS.some((s) => line.startsWith(s))) continue;
      if (SKIP_CONTAINS.some((s) => line.includes(s))) continue;
      if (DETAIL_STARTS.some((s) => line.startsWith(s))) continue;

      // DES:/REM: — update the last transaction's description
      if (line.startsWith("DES:") || line.startsWith("REM:")) {
        const extra = line.slice(4).replace(/\s+\d{2}\/\d{2}$/, "").trim();
        if (txns.length > 0 && extra) {
          const last = txns[txns.length - 1];
          last.desc = last.base ? `${last.base} - ${extra}` : extra;
        }
        continue;
      }

      // REMET. — TED sender, update the last transaction
      if (line.startsWith("REMET.")) {
        if (txns.length > 0) {
          const last = txns[txns.length - 1];
          const rest = line.slice(6).trim();
          last.desc = last.base ? `${last.base} - ${rest}` : line;
        }
        continue;
      }

      // Date line: DD/MM/YYYY ...
      const dateMatch = line.match(DATE_LINE_RE);
      if (dateMatch) {
        const [d, m, y] = dateMatch[1].split("/");
        const date = parseBrDate(Number(d), Number(m), Number(y));
        if (!date) continue;
        currentDate = date;

        const rest = dateMatch[2].trim();
        const amounts = findAllAmounts(rest);
        if (amounts.length >= 2) {
          const amount = parseBrAmount(amounts[0]);
          // Extract text description (strip amounts and doc numbers)
          let restDesc = rest.replace(new RegExp(AMOUNT_RE.source, "g"), "").trim();
          restDesc = restDesc.replace(/\b\d+\b/g, "").trim().replace(/^\*+|\*+$/g, "");
          if (restDesc) pendingType = restDesc;
          add(txns, currentDate, pendingType, amount);
        }
        continue;
      }

      // Data line without date: doc amount balance
      const amounts = findAllAmounts(line);
      if (amounts.length >= 2 && /^\d+\s/.test(line)) {
        if (currentDate) {
          add(txns, currentDate, pendingType, parseBrAmount(amounts[0]));
        }
        continue;
      }

      // Otherwise: type label for the next transaction
      pendingType = line;
    }
  }

  return txns.map((t) => ({ date: t.date, description: t.desc, amount: t.amount }));
}

function add(txns: PendingTxn[], txnDate: string, pendingType: string, amount: number | null): void {
  if (amount === null || amount < 0.05) return;
  const label = pendingType || "Transaction";
  txns.push({ date: txnDate, desc: label, base: label, amount });
}
