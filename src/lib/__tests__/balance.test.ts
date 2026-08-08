import { describe, it, expect } from "vitest";
import { balanceTotals } from "@/lib/balance";

// Dates in this app are date-only strings parsed as UTC midnight — build the
// fixtures the same way so the month filter is exercised on real input.
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

const debt = (amount: number, iso: string, paid = false) => ({ amount, date: at(iso), paid });
const payment = (amount: number, iso: string) => ({ amount, date: at(iso) });

describe("balanceTotals", () => {
  it("returns zeros for an empty ledger", () => {
    expect(balanceTotals([], [])).toEqual({ totalOwed: 0, totalPaid: 0 });
  });

  it("owes the sum of the unpaid debts and ignores the paid ones", () => {
    const totals = balanceTotals(
      [debt(100, "2026-03-10"), debt(900, "2026-03-11", true), debt(50, "2026-03-12")],
      []
    );
    expect(totals.totalOwed).toBe(150);
  });

  it("sums every payment into totalPaid", () => {
    const totals = balanceTotals([], [payment(100, "2026-03-10"), payment(50, "2026-03-20")]);
    expect(totals.totalPaid).toBe(150);
  });

  // The whole point of the flat model: a payment never touches what is owed,
  // so an installment marked paid *and* covered by a payment is deducted once.
  it("never subtracts payments from what is owed", () => {
    const totals = balanceTotals(
      [debt(100, "2026-03-10", true), debt(100, "2026-04-10")],
      [payment(100, "2026-03-10")]
    );
    expect(totals).toEqual({ totalOwed: 100, totalPaid: 100 });
  });

  it("cannot go negative when payments exceed the open debts", () => {
    const totals = balanceTotals([], [payment(300, "2026-03-10")]);
    expect(totals).toEqual({ totalOwed: 0, totalPaid: 300 });
  });

  it("scopes both sides to the selected month", () => {
    const debts = [debt(100, "2026-02-28"), debt(200, "2026-03-01"), debt(400, "2026-04-01")];
    const payments = [payment(10, "2026-02-28"), payment(20, "2026-03-31")];

    expect(balanceTotals(debts, payments, "2026-03")).toEqual({ totalOwed: 200, totalPaid: 20 });
    expect(balanceTotals(debts, payments, "2026-02")).toEqual({ totalOwed: 100, totalPaid: 10 });
  });

  it("still skips paid debts inside the selected month", () => {
    const debts = [debt(100, "2026-03-05"), debt(900, "2026-03-06", true)];
    expect(balanceTotals(debts, [], "2026-03").totalOwed).toBe(100);
  });

  it("returns zeros for a month with nothing in it", () => {
    expect(balanceTotals([debt(100, "2026-03-05")], [payment(10, "2026-03-05")], "2026-05")).toEqual({
      totalOwed: 0,
      totalPaid: 0,
    });
  });

  // getMonthKey reads UTC components; a local-time reading would push the
  // last day of a month into the next one west of UTC.
  it("keeps a month-boundary date in its own month", () => {
    expect(balanceTotals([debt(100, "2026-03-31")], [], "2026-03").totalOwed).toBe(100);
    expect(balanceTotals([debt(100, "2026-04-01")], [], "2026-03").totalOwed).toBe(0);
  });
});
