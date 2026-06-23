export const PAYMENT_METHODS = {
  PIX: "Pix",
  CASH: "Dinheiro",
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;
