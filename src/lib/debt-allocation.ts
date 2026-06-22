export interface AllocatableDebt {
  id: string;
  amount: number;
}

/**
 * Returns the set of debt IDs that are "covered" by the total amount paid,
 * allocating greedily from the smallest debt to the largest.
 * This is purely for visual/indicative purposes - it does not mutate anything.
 */

export function calculateCoveredDebtIds(
  debts: AllocatableDebt[],
  totalPaid: number
): Set<string> {
  const sortedAscending = [...debts].sort((a, b) => a.amount - b.amount);
  const coveredIds = new Set<string>();
  let remaining = totalPaid;

  for (const debt of sortedAscending) {
    if (remaining >= debt.amount) {
      coveredIds.add(debt.id);
      remaining -= debt.amount;
    } else {
      break; // every remaining debt is >= this one, so none will fit
    }
  }

  return coveredIds;
}