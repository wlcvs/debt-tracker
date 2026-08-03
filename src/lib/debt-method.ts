const DEBT_METHODS = ["PIX", "CASH"] as const;

export function resolveDebtMethod(debtMethod: string | undefined): { method: "PIX" | "CASH" | null; creditCardId: string | null } {
  const isEnumMethod = DEBT_METHODS.includes(debtMethod as typeof DEBT_METHODS[number]);
  return {
    method: isEnumMethod ? (debtMethod as "PIX" | "CASH") : null,
    creditCardId: !isEnumMethod && debtMethod ? debtMethod : null,
  };
}
