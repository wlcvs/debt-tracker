// Uses real bank statement PDFs kept locally (gitignored, never committed —
// see .gitignore) as fixtures. Skips gracefully wherever they aren't present
// (CI, other contributors' machines) rather than failing the suite.
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { detectAndParse } from "@/lib/importers";
import * as nubank from "@/lib/importers/nubank";
import * as itau from "@/lib/importers/itau";
import * as mercadopago from "@/lib/importers/mercadopago";
import * as bradesco from "@/lib/importers/bradesco";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function fixture(name: string): Buffer | null {
  const p = path.join(FIXTURES_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

describe("bank statement parsers (real PDFs)", () => {
  it("parses a Bradesco statement", async () => {
    const data = fixture("8b5e4279-81c5-4df5-a4a9-1f403bdf7155.pdf");
    if (!data) return;

    const txns = await bradesco.parse(data);
    expect(txns).toHaveLength(14);
    expect(txns[0]).toMatchObject({ date: expect.any(String), description: expect.any(String) });
  });

  it("parses a Nubank current-account (conta corrente) statement", async () => {
    const data = fixture("NU_237744153_01MAI2026_31MAI2026.pdf");
    if (!data) return;

    const txns = await nubank.parse(data);
    expect(txns).toHaveLength(49);
  });

  it("parses a Nubank credit card (fatura) statement", async () => {
    const data = fixture("Nubank_2026-06-11.pdf");
    if (!data) return;

    const txns = await nubank.parse(data);
    expect(txns).toHaveLength(48);
  });

  it("parses a Mercado Pago statement", async () => {
    const data = fixture("credit-card-mp-statement.pdf");
    if (!data) return;

    const txns = await mercadopago.parse(data);
    expect(txns).toEqual([
      { date: "2026-04-22", description: "MP*CARLOSJORGEMA Parcela 2 de 3", amount: 111.23 },
      { date: "2026-06-08", description: "SUPERMERCADO PORTO SEG", amount: 195.23 },
    ]);
  });

  it("parses an Itaú fatura, bounding the description at the column merge", async () => {
    const data = fixture("Fatura_Itau_20260629-180424.pdf");
    if (!data) return;

    const txns = await itau.parse(data);
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(156.68);
    expect(txns[0].date).toBe("2026-03-27");
  });

  it("detectAndParse identifies the bank from PDF content", async () => {
    const data = fixture("credit-card-mp-statement.pdf");
    if (!data) return;

    const result = await detectAndParse(data);
    expect(result.bank).toBe("Mercado Pago");
    expect(result.transactions).toHaveLength(2);
  });
});
