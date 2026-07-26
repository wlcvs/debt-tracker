export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

export function paidPercent(totalPaid: number, totalDebt: number): number {
  if (totalDebt <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((totalPaid / totalDebt) * 100)));
}
