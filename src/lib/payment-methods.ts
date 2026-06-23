export const PAYMENT_METHODS = {
  PIX: "Pix",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão",
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;
