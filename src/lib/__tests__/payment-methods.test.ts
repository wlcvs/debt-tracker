import { describe, it, expect } from "vitest";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

describe("PAYMENT_METHODS", () => {
  it("maps PIX to 'Pix'", () => {
    expect(PAYMENT_METHODS.PIX).toBe("Pix");
  });

  it("maps CASH to 'Dinheiro'", () => {
    expect(PAYMENT_METHODS.CASH).toBe("Dinheiro");
  });

  it("only exposes PIX and CASH keys", () => {
    expect(Object.keys(PAYMENT_METHODS)).toEqual(["PIX", "CASH"]);
  });
});
