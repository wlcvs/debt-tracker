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
    form.set("personId", "person-99");
    form.set("amount", "100");
    form.set("title", "Almoço");
    form.set("date", "2025-01-01");

    await expect(createDebt(form)).rejects.toThrow("Person not found");
  });

  it("creates debt for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    form.set("personId", "person-1");
    form.set("amount", "-50");
    form.set("title", "X");
    form.set("date", "2025-01-01");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("creates a single debt already marked as paid when paid=on", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);
    prismaMock.debt.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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

  it("distributes leftover cents onto the last installments", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "10");
    form.set("title", "Compra");
    form.set("date", "2026-01-01");
    form.set("installments", "3");

    await createDebt(form);

    const data = prismaMock.debt.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    const amounts = data.map((d) => d.amount as number);
    expect(amounts).toEqual([3.33, 3.33, 3.34]);
  });

  it("creates installments backward, treating the given date as the last installment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
    form.set("personId", "person-1");
    form.set("amount", "100");
    form.set("title", "X");
    form.set("date", "2026-01-01");
    form.set("installments", "61");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("throws on a non-integer installments value", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "100");
    form.set("title", "X");
    form.set("date", "2026-01-01");
    form.set("installments", "2.5");
    await expect(createDebt(form)).rejects.toThrow();
  });

  it("defaults installmentDirection to forward when omitted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);

    const form = new FormData();
    form.set("personId", "person-1");
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
        personId: "person-1",
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
    });
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(50);
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
        personId: "person-1",
        amount: 50,
        title: "X (1/2)",
        date: new Date("2026-01-01"),
        paid: true,
        installmentIndex: 1,
        installmentTotal: 2,
      },
      {
        id: "d2",
        personId: "person-1",
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
