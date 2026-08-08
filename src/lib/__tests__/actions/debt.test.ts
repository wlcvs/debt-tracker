import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import {
  createDebt,
  deleteDebt,
  deleteDebtInstallmentGroup,
  getDebtInstallmentGroup,
  toggleDebtPaid,
  toggleDebtsPaidBulk,
  updateDebt,
  updateDebtInstallmentGroup,
} from "@/lib/actions/debt";

const mockAuth = vi.mocked(auth);

function localDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.debt.deleteMany.mockResolvedValue({} as never);
  prismaMock.debt.updateMany.mockResolvedValue({} as never);
  prismaMock.debt.createMany.mockResolvedValue({} as never);
  prismaMock.debt.findFirst.mockResolvedValue(null);
  prismaMock.debt.findMany.mockResolvedValue([]);
  prismaMock.debt.update.mockResolvedValue({} as never);
});

// ── createDebt ────────────────────────────────────────────────────────────────

describe("createDebt", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(createDebt(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when person does not belong to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);

    const form = new FormData();
    form.set("personAccessCode", "CODE99");
    form.set("amount", "100");
    form.set("title", "Almoço");
    form.set("date", "2025-01-01");

    await expect(createDebt(form)).rejects.toThrow("Person not found");
  });

  it("creates debt for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "150");
    form.set("title", "Jantar");
    form.set("description", "Com sobremesa");
    form.set("date", "2025-03-10");

    await createDebt(form);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: "person-1",
          amount: 150,
          title: "Jantar",
          description: "Com sobremesa",
          paid: false,
        }),
      })
    );
  });

  it("defaults description to empty string when omitted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "150");
    form.set("title", "Jantar");
    form.set("date", "2025-03-10");

    await createDebt(form);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: "" }) })
    );
  });

  it("throws on non-positive amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "-50");
    form.set("title", "X");
    form.set("date", "2025-01-01");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("creates a single debt already marked as paid when paid=on", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "150");
    form.set("title", "Jantar");
    form.set("date", "2025-03-10");
    form.set("paid", "on");

    await createDebt(form);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: true }) })
    );
  });

  it("creates N installments forward with a shared installmentGroupId, cent-accurate split and monthly dates", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "100");
    form.set("title", "Notebook");
    form.set("date", "2026-01-31");
    form.set("installments", "3");
    form.set("installmentDirection", "forward");

    await createDebt(form);

    expect(prismaMock.debt.createMany).toHaveBeenCalledTimes(1);
    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(3);

    const groupIds = new Set(data.map((d) => d.installmentGroupId));
    expect(groupIds.size).toBe(1);

    const amounts = data.map((d) => d.amount as number);
    expect(amounts.reduce((s, a) => s + a, 0)).toBeCloseTo(100, 2);

    expect(data[0]).toMatchObject({ installmentIndex: 1, installmentTotal: 3, title: "Notebook (1/3)" });
    expect(localDateStr(data[0].date as Date)).toBe("2026-01-31");
    expect(localDateStr(data[1].date as Date)).toBe("2026-02-28");
    expect(localDateStr(data[2].date as Date)).toBe("2026-03-31");
  });

  it("distributes leftover cents onto the first installments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "10");
    form.set("title", "Compra");
    form.set("date", "2026-01-01");
    form.set("installments", "3");

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    const amounts = data.map((d) => d.amount as number);
    expect(amounts).toEqual([3.34, 3.33, 3.33]);
  });

  it("creates installments backward, treating the given date as the last installment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "300");
    form.set("title", "Retroativo");
    form.set("date", "2026-03-31");
    form.set("installments", "3");
    form.set("installmentDirection", "backward");

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(localDateStr(data[0].date as Date)).toBe("2026-01-31");
    expect(localDateStr(data[1].date as Date)).toBe("2026-02-28");
    expect(localDateStr(data[2].date as Date)).toBe("2026-03-31");
  });

  it("marks the requested indexes as paid via paidInstallments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "300");
    form.set("title", "Retroativo");
    form.set("date", "2026-03-31");
    form.set("installments", "3");
    form.set("installmentDirection", "backward");
    form.set("paidInstallments", JSON.stringify([1, 2]));

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(data.map((d) => d.paid)).toEqual([true, true, false]);
  });

  it("marks only a non-contiguous subset of indexes as paid (e.g. 1 and 3 of 4)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "400");
    form.set("title", "Celular");
    form.set("date", "2026-01-01");
    form.set("installments", "4");
    form.set("paidInstallments", JSON.stringify([1, 3]));

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(data.map((d) => d.paid)).toEqual([true, false, true, false]);
  });

  it("ignores out-of-range indexes in paidInstallments without marking anything incorrectly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "300");
    form.set("title", "X");
    form.set("date", "2026-01-01");
    form.set("installments", "3");
    form.set("paidInstallments", JSON.stringify([5, 99]));

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(data.map((d) => d.paid)).toEqual([false, false, false]);
  });

  it("throws when installments exceeds the max of 60", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "100");
    form.set("title", "X");
    form.set("date", "2026-01-01");
    form.set("installments", "61");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("throws on a non-integer installments value", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "100");
    form.set("title", "X");
    form.set("date", "2026-01-01");
    form.set("installments", "2.5");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("defaults installmentDirection to forward when omitted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "300");
    form.set("title", "X");
    form.set("date", "2026-01-31");
    form.set("installments", "3");
    // installmentDirection intentionally omitted

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(localDateStr(data[0].date as Date)).toBe("2026-01-31");
    expect(localDateStr(data[1].date as Date)).toBe("2026-02-28");
    expect(localDateStr(data[2].date as Date)).toBe("2026-03-31");
  });

  // Presence of the field — not its value — is what picks the branch, so that
  // installments=1 can be a real 1/1 group while an ordinary debt (which never
  // sends the field) stays ungrouped.
  it("creates a real 1/1 group when installments=1", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "685,91");
    form.set("title", "Cama do Presley");
    form.set("date", "2026-03-10");
    form.set("installments", "1");
    form.set("paidInstallments", JSON.stringify([1]));

    await createDebt(form);

    expect(prismaMock.debt.create).not.toHaveBeenCalled();
    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      title: "Cama do Presley (1/1)",
      amount: 685.91,
      installmentIndex: 1,
      installmentTotal: 1,
      paid: true,
    });
    expect(data[0].installmentGroupId).toEqual(expect.any(String));
    expect(localDateStr(data[0].date as Date)).toBe("2026-03-10");
  });

  it("creates a plain ungrouped debt when installments is omitted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "100");
    form.set("title", "Almoço");
    form.set("date", "2026-03-10");

    await createDebt(form);

    expect(prismaMock.debt.createMany).not.toHaveBeenCalled();
    const { data } = prismaMock.debt.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.title).toBe("Almoço");
    expect(data.installmentGroupId).toBeUndefined();
  });

  // The whole "Salvar não faz nada" bug: z.coerce.number() turns "685,91" into
  // NaN, the action throws, and the form silently stays open.
  it("accepts an amount typed with a pt-BR comma", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personAccessCode", "CODE1");
    form.set("amount", "1.234,56");
    form.set("title", "Sofá");
    form.set("date", "2026-03-10");

    await createDebt(form);

    const { data } = prismaMock.debt.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.amount).toBe(1234.56);
  });
});

// ── deleteDebt ────────────────────────────────────────────────────────────────

describe("deleteDebt", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deleteDebt(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes debt scoped to user via person", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    await deleteDebt(form);
    expect(prismaMock.debt.deleteMany).toHaveBeenCalledWith({
      where: { id: "debt-1", person: { userId: "user-1" } },
    });
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deleteDebt(new FormData())).rejects.toThrow();
  });
});

// ── deleteDebtInstallmentGroup ───────────────────────────────────────────────

describe("deleteDebtInstallmentGroup", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deleteDebtInstallmentGroup(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes all debts scoped to the group and user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("installmentGroupId", "group-1");
    await deleteDebtInstallmentGroup(form);
    expect(prismaMock.debt.deleteMany).toHaveBeenCalledWith({
      where: { installmentGroupId: "group-1", person: { userId: "user-1" } },
    });
  });

  it("throws when installmentGroupId is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deleteDebtInstallmentGroup(new FormData())).rejects.toThrow();
  });
});

// ── updateDebtInstallmentGroup ───────────────────────────────────────────────

describe("updateDebtInstallmentGroup", () => {
  // Rows as they'd come back from the ownership findMany, oldest index first.
  function existingGroup(count: number, paidIndexes: number[] = []) {
    return Array.from({ length: count }, (_, i) => ({
      id: `d${i + 1}`,
      personId: "p1",
      installmentGroupId: "group-1",
      installmentIndex: i + 1,
      installmentTotal: count,
      paid: paidIndexes.includes(i + 1),
    }));
  }

  function groupForm(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set("installmentGroupId", "group-1");
    form.set("title", "Supermercado");
    form.set("description", "");
    form.set("amount", "300,00");
    form.set("date", "2026-03-10");
    form.set("installments", "3");
    form.set("debtMethod", "PIX");
    for (const [k, v] of Object.entries(overrides)) form.set(k, v);
    return form;
  }

  type UpdateCall = { where: { id: string }; data: Record<string, unknown> };
  const updateCalls = () => prismaMock.debt.update.mock.calls.map(([arg]) => arg as UpdateCall);

  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(updateDebtInstallmentGroup(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("scopes the group lookup to the authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(3) as never);

    await updateDebtInstallmentGroup(groupForm());

    expect(prismaMock.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { installmentGroupId: "group-1", person: { userId: "user-1" } },
      })
    );
  });

  // A group belonging to someone else comes back empty from that same
  // ownership-scoped query, so it can't be edited.
  it("throws when the group does not exist or belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([] as never);

    await expect(updateDebtInstallmentGroup(groupForm())).rejects.toThrow("Installment group not found");
    expect(prismaMock.debt.update).not.toHaveBeenCalled();
    expect(prismaMock.debt.createMany).not.toHaveBeenCalled();
  });

  it("rewrites every row's amount, title suffix and date from the new total", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(3) as never);

    await updateDebtInstallmentGroup(groupForm());

    const calls = updateCalls();
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.where)).toEqual([{ id: "d1" }, { id: "d2" }, { id: "d3" }]);
    expect(calls.map((c) => c.data.amount)).toEqual([100, 100, 100]);
    expect(calls.map((c) => c.data.title)).toEqual([
      "Supermercado (1/3)",
      "Supermercado (2/3)",
      "Supermercado (3/3)",
    ]);
    expect(calls.map((c) => localDateStr(c.data.date as Date))).toEqual([
      "2026-03-10",
      "2026-04-10",
      "2026-05-10",
    ]);
    expect(calls.every((c) => c.data.installmentTotal === 3)).toBe(true);
  });

  // Same split rule as createDebt: the leftover cents go on the first
  // installments (685,91 in 10x -> 68,60 + 9x 68,59).
  it("puts the leftover cent on the first installments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(10) as never);

    await updateDebtInstallmentGroup(groupForm({ amount: "685,91", installments: "10" }));

    const amounts = updateCalls().map((c) => c.data.amount);
    expect(amounts[0]).toBe(68.6);
    expect(amounts.slice(1)).toEqual(Array(9).fill(68.59));
    expect(amounts.reduce((s: number, a) => s + (a as number), 0)).toBeCloseTo(685.91, 2);
  });

  // The whole reason surviving rows are updated in place instead of dropped
  // and recreated.
  it("never touches the paid flag of a surviving installment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(3, [1, 2]) as never);

    await updateDebtInstallmentGroup(groupForm());

    expect(updateCalls().every((c) => !("paid" in c.data))).toBe(true);
  });

  it("deletes only the extra rows when the count shrinks", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(5) as never);

    await updateDebtInstallmentGroup(groupForm({ installments: "2", amount: "200,00" }));

    expect(updateCalls().map((c) => c.where)).toEqual([{ id: "d1" }, { id: "d2" }]);
    expect(prismaMock.debt.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["d3", "d4", "d5"] } },
    });
    expect(prismaMock.debt.createMany).not.toHaveBeenCalled();
  });

  it("appends unpaid rows to the same group when the count grows", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2, [1]) as never);

    await updateDebtInstallmentGroup(groupForm({ installments: "4", amount: "400,00" }));

    expect(updateCalls()).toHaveLength(2);
    expect(prismaMock.debt.deleteMany).not.toHaveBeenCalled();

    const created = (prismaMock.debt.createMany.mock.calls[0][0] as { data: Record<string, unknown>[] }).data;
    expect(created).toHaveLength(2);
    expect(created.map((r) => r.installmentIndex)).toEqual([3, 4]);
    expect(created.map((r) => r.title)).toEqual(["Supermercado (3/4)", "Supermercado (4/4)"]);
    expect(created.every((r) => r.paid === false)).toBe(true);
    expect(created.every((r) => r.installmentGroupId === "group-1")).toBe(true);
    expect(created.every((r) => r.personId === "p1")).toBe(true);
    expect(created.map((r) => localDateStr(r.date as Date))).toEqual(["2026-05-10", "2026-06-10"]);
  });

  it("resolves a credit card id into creditCardId with a null method", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2) as never);

    await updateDebtInstallmentGroup(groupForm({ debtMethod: "card-9", installments: "2", amount: "200,00" }));

    const [{ data }] = updateCalls();
    expect(data.creditCardId).toBe("card-9");
    expect(data.method).toBeNull();
  });

  it("parses a pt-BR amount rather than producing NaN", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2) as never);

    await updateDebtInstallmentGroup(groupForm({ amount: "1.234,56", installments: "2" }));

    const amounts = updateCalls().map((c) => c.data.amount);
    expect(amounts).toEqual([617.28, 617.28]);
  });

  it("rejects an empty title", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2) as never);

    await expect(updateDebtInstallmentGroup(groupForm({ title: "   " }))).rejects.toThrow();
  });

  it("rejects a count outside 1..60", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2) as never);

    await expect(updateDebtInstallmentGroup(groupForm({ installments: "0" }))).rejects.toThrow();
    await expect(updateDebtInstallmentGroup(groupForm({ installments: "61" }))).rejects.toThrow();
  });

  it("rejects a zero amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(2) as never);

    await expect(updateDebtInstallmentGroup(groupForm({ amount: "0" }))).rejects.toThrow();
  });

  // addMonthsClamped: Jan 31 + 1 month lands on Feb 28, not Mar 3.
  it("clamps a day-of-month overflow when stepping the dates", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue(existingGroup(3) as never);

    await updateDebtInstallmentGroup(groupForm({ date: "2026-01-31", installments: "3" }));

    expect(updateCalls().map((c) => localDateStr(c.data.date as Date))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
});

// ── updateDebt ────────────────────────────────────────────────────────────────

describe("updateDebt", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(updateDebt(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("amount", "200");
    form.set("title", "X");
    form.set("date", "2025-05-01");
    await expect(updateDebt(form)).rejects.toThrow();
  });

  it("throws on non-positive amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    form.set("amount", "0");
    form.set("title", "X");
    form.set("date", "2025-05-01");
    await expect(updateDebt(form)).rejects.toThrow();
  });

  it("updates debt fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    form.set("amount", "200");
    form.set("title", "Jantar atualizado");
    form.set("date", "2025-05-01");
    await updateDebt(form);
    expect(prismaMock.debt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "debt-1", person: { userId: "user-1" } },
        data: expect.objectContaining({ amount: 200, title: "Jantar atualizado" }),
      })
    );
  });

  it("sets an enum method and clears the credit card", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    form.set("amount", "200");
    form.set("title", "Jantar");
    form.set("date", "2025-05-01");
    form.set("debtMethod", "PIX");
    await updateDebt(form);
    expect(prismaMock.debt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: "PIX", creditCardId: null }) })
    );
  });

  it("sets a credit card and clears the enum method", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    form.set("amount", "200");
    form.set("title", "Jantar");
    form.set("date", "2025-05-01");
    form.set("debtMethod", "card-123");
    await updateDebt(form);
    expect(prismaMock.debt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: null, creditCardId: "card-123" }) })
    );
  });
});

// ── toggleDebtPaid ────────────────────────────────────────────────────────────

describe("toggleDebtPaid", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(toggleDebtPaid(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when debt does not belong to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findFirst.mockResolvedValue(null);
    const form = new FormData();
    form.set("id", "debt-1");
    await expect(toggleDebtPaid(form)).rejects.toThrow("Debt not found");
  });

  it("flips paid from false to true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findFirst.mockResolvedValue({ id: "debt-1", paid: false } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    await toggleDebtPaid(form);
    expect(prismaMock.debt.update).toHaveBeenCalledWith({
      where: { id: "debt-1" },
      data: { paid: true },
    });
  });

  it("flips paid from true to false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findFirst.mockResolvedValue({ id: "debt-1", paid: true } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    await toggleDebtPaid(form);
    expect(prismaMock.debt.update).toHaveBeenCalledWith({
      where: { id: "debt-1" },
      data: { paid: false },
    });
  });
});

// ── toggleDebtsPaidBulk ───────────────────────────────────────────────────────

describe("toggleDebtsPaidBulk", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(toggleDebtsPaidBulk(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("marks only the given ids as paid, scoped to the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("debtIds", JSON.stringify(["debt-1", "debt-2"]));
    await toggleDebtsPaidBulk(form);
    expect(prismaMock.debt.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["debt-1", "debt-2"] }, person: { userId: "user-1" } },
      data: { paid: true },
    });
  });

  it("throws on empty id list", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("debtIds", JSON.stringify([]));
    await expect(toggleDebtsPaidBulk(form)).rejects.toThrow();
  });

  it("throws when debtIds field is missing entirely", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(toggleDebtsPaidBulk(new FormData())).rejects.toThrow();
  });

  it("marks only a partial selection within a larger group, leaving the rest out of the query", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    // Group has debt-1, debt-2, debt-3 but only debt-1 and debt-3 are selected.
    form.set("debtIds", JSON.stringify(["debt-1", "debt-3"]));
    await toggleDebtsPaidBulk(form);
    expect(prismaMock.debt.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["debt-1", "debt-3"] }, person: { userId: "user-1" } },
      data: { paid: true },
    });
    const call = prismaMock.debt.updateMany.mock.calls[0][0];
    expect(call.where.id.in).not.toContain("debt-2");
  });
});

// ── getDebtInstallmentGroup ───────────────────────────────────────────────────

describe("getDebtInstallmentGroup", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getDebtInstallmentGroup("group-1")).rejects.toThrow("Not authenticated");
  });

  it("returns installments scoped to the user's group, ordered by index", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([
      {
        id: "d1",
        person: { accessCode: "CODE1" },
        amount: 50,
        title: "X (1/2)",
        date: new Date("2026-01-01"),
        paid: false,
        installmentIndex: 1,
        installmentTotal: 2,
      },
    ] as never);

    const result = await getDebtInstallmentGroup("group-1");
    expect(prismaMock.debt.findMany).toHaveBeenCalledWith({
      where: { installmentGroupId: "group-1", person: { userId: "user-1" } },
      orderBy: { installmentIndex: "asc" },
      include: { person: { select: { accessCode: true } } },
    });
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(50);
  });

  // The panel's edit form prefills the whole purchase from this payload.
  it("returns the description and method the edit form prefills from", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([
      {
        id: "d1",
        person: { accessCode: "CODE1" },
        amount: 50,
        title: "X (1/2)",
        description: "Compra do mês",
        method: null,
        creditCardId: "card-9",
        date: new Date("2026-01-01"),
        paid: false,
        installmentIndex: 1,
        installmentTotal: 2,
      },
    ] as never);

    const [installment] = await getDebtInstallmentGroup("group-1");
    expect(installment.description).toBe("Compra do mês");
    expect(installment.method).toBeNull();
    expect(installment.creditCardId).toBe("card-9");
  });

  it("never exposes the person's DB id, only their access code", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([
      {
        id: "d1",
        personId: "p1",
        person: { accessCode: "CODE1" },
        amount: 50,
        title: "X (1/2)",
        description: "",
        method: "PIX",
        creditCardId: null,
        date: new Date("2026-01-01"),
        paid: false,
        installmentIndex: 1,
        installmentTotal: 2,
      },
    ] as never);

    const [installment] = await getDebtInstallmentGroup("group-1");
    expect(installment).not.toHaveProperty("personId");
    expect(installment.personAccessCode).toBe("CODE1");
  });

  it("returns an empty array when no debts match the group", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([]);
    const result = await getDebtInstallmentGroup("nonexistent-group");
    expect(result).toEqual([]);
  });

  it("preserves each installment's own paid flag in the mapped result", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.findMany.mockResolvedValue([
      {
        id: "d1",
        person: { accessCode: "CODE1" },
        amount: 50,
        title: "X (1/2)",
        date: new Date("2026-01-01"),
        paid: true,
        installmentIndex: 1,
        installmentTotal: 2,
      },
      {
        id: "d2",
        person: { accessCode: "CODE1" },
        amount: 50,
        title: "X (2/2)",
        date: new Date("2026-02-01"),
        paid: false,
        installmentIndex: 2,
        installmentTotal: 2,
      },
    ] as never);

    const result = await getDebtInstallmentGroup("group-1");
    expect(result.map((d) => d.paid)).toEqual([true, false]);
  });
});
