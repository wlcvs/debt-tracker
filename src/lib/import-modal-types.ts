export type TxnType = "ignore" | "debt" | "payment";

export type EditingCell = { index: number | string; field: "description" | "date" | "amount" } | null;

export interface Txn {
  index: number | string;
  date: string;
  description: string;
  amount: number | string;
  personId: string;
  type: TxnType;
  manual?: boolean;
  title?: string;
  notes?: string;
  method?: string;
}

export function formatAmount(s: number | string): string {
  return parseFloat(String(s)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
