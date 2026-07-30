import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import {
  createPerson,
  deletePerson,
  updatePerson,
  getPersonById,
  getDashboardOverview,
  getDebtorViewById,
  togglePersonPublicVisibility,
} from "@/lib/actions/person";

const mockAuth = vi.mocked(auth);

type ExtendedPerson = typeof prismaMock.person & {
  deleteMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  (prismaMock.person as ExtendedPerson).deleteMany = vi.fn().mockResolvedValue({});
  (prismaMock.person as ExtendedPerson).updateMany = vi.fn().mockResolvedValue({});
});

// ── createPerson ──────────────────────────────────────────────────────────────

describe("createPerson", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const form = new FormData();
    form.set("name", "João");
    await expect(createPerson(form)).rejects.toThrow("Not authenticated");
  });

  it("creates person with name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("name", "João");
    await createPerson(form);

    expect(prismaMock.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "João", userId: "user-1" }),
      })
    );
  });

  it("throws on empty name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("name", "  ");
    await expect(createPerson(form)).rejects.toThrow();
  });

  it("trims surrounding whitespace from the name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("name", "  Ana  ");
    await createPerson(form);

    expect(prismaMock.person.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Ana" }) })
    );
  });
});

// ── deletePerson ──────────────────────────────────────────────────────────────

describe("deletePerson", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deletePerson(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes only if person belongs to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "person-1");
    await deletePerson(form);
    expect((prismaMock.person as ExtendedPerson).deleteMany).toHaveBeenCalledWith({
      where: { id: "person-1", userId: "user-1" },
    });
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deletePerson(new FormData())).rejects.toThrow();
  });

  it("scopes the delete to a different authenticated user's ownership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    const form = new FormData();
    form.set("id", "person-9");
    await deletePerson(form);
    expect((prismaMock.person as ExtendedPerson).deleteMany).toHaveBeenCalledWith({
      where: { id: "person-9", userId: "user-2" },
    });
  });
});

// ── updatePerson ──────────────────────────────────────────────────────────────

describe("updatePerson", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(updatePerson(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("updates person name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "person-1");
    form.set("name", "Maria");
    await updatePerson(form);
    expect((prismaMock.person as ExtendedPerson).updateMany).toHaveBeenCalledWith({
      where: { id: "person-1", userId: "user-1" },
      data: { name: "Maria" },
    });
  });

  it("throws on empty name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "person-1");
    form.set("name", "  ");
    await expect(updatePerson(form)).rejects.toThrow();
  });

  it("trims surrounding whitespace from the updated name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "person-1");
    form.set("name", "  Maria  ");
    await updatePerson(form);
    expect((prismaMock.person as ExtendedPerson).updateMany).toHaveBeenCalledWith({
      where: { id: "person-1", userId: "user-1" },
      data: { name: "Maria" },
    });
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("name", "Maria");
    await expect(updatePerson(form)).rejects.toThrow();
  });
});

// ── getPersonById ─────────────────────────────────────────────────────────────

describe("getPersonById", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getPersonById("any-id")).rejects.toThrow("Not authenticated");
  });

  it("returns null when not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);
    expect(await getPersonById("x")).toBeNull();
  });

  it("returns person with correct balance", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      name: "João",
      debts: [
        { id: "d1", amount: 100, description: "X", date: new Date() },
        { id: "d2", amount: 300, description: "Y", date: new Date() },
      ],
      payments: [{ id: "pay1", amount: 100, date: new Date(), method: "PIX" }],
    } as never);

    const result = await getPersonById("p1");
    expect(result!.totalOwed).toBe(300);
    expect(result!.debts).toHaveLength(2);
  });

  it("excludes paid debts from totalOwed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      name: "João",
      debts: [
        { id: "d1", amount: 100, title: "X", description: "", paid: false, date: new Date() },
        { id: "d2", amount: 900, title: "Y", description: "", paid: true, date: new Date() },
      ],
      payments: [],
    } as never);

    const result = await getPersonById("p1");
    expect(result!.totalOwed).toBe(100);
  });
});

// ── getDashboardOverview ──────────────────────────────────────────────────────

describe("getDashboardOverview", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getDashboardOverview()).rejects.toThrow("Not authenticated");
  });

  it("computes totals for an active debtor (unpaid debt, no payment)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([
      { personId: "p1", _sum: { amount: 500 } },
    ] as never);
    prismaMock.payment.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people).toEqual([{ id: "p1", name: "João", totalOwed: 500 }]);
    expect(stats.totalToReceive).toBe(500);
    expect(stats.activeDebtors).toBe(1);
    expect(stats.totalDebtors).toBe(1);
    expect(stats.totalDebts).toBe(1);
    expect(stats.totalPayments).toBe(0);
    expect(stats.totalPaid).toBe(0);
  });

  it("counts a paid debt in totalDebts but excludes it from the balance", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", name: "João" }] as never);
    // paid: false in the groupBy's where filters the paid debt out entirely,
    // so it never contributes a _sum row — only the unfiltered count sees it.
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.payment.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people[0].totalOwed).toBe(0);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalDebts).toBe(1);
  });

  it("clamps a fully-paid balance (payments >= debt) to zero and does not count it as active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([
      { personId: "p1", _sum: { amount: 200 } },
    ] as never);
    prismaMock.payment.groupBy.mockResolvedValue([
      { personId: "p1", _sum: { amount: 300 } },
    ] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 300 }, _count: 1 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people[0].totalOwed).toBe(-100);
    expect(stats.totalToReceive).toBe(0);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalPaid).toBe(300);
  });

  it("returns a person with no debts/payments as zero balance, not active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.payment.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(0);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people).toEqual([{ id: "p1", name: "João", totalOwed: 0 }]);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalToReceive).toBe(0);
  });
});

// ── getDebtorViewById ─────────────────────────────────────────────────────────

describe("getDebtorViewById", () => {
  it("returns null when id not found", async () => {
    prismaMock.person.findUnique.mockResolvedValue(null);
    expect(await getDebtorViewById("bad")).toBeNull();
  });

  it("returns debtor view with correct balance", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Maria",
      debts: [{ id: "d1", amount: 200, description: "X", date: new Date() }],
      payments: [{ id: "pay1", amount: 50, date: new Date(), method: "PIX" }],
    } as never);

    const result = await getDebtorViewById("valid-id");
    expect(result!.name).toBe("Maria");
    expect(result!.totalOwed).toBe(150);
  });

  it("excludes paid debts from totalOwed", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Maria",
      debts: [
        { id: "d1", amount: 200, title: "X", description: "", paid: false, date: new Date() },
        { id: "d2", amount: 800, title: "Y", description: "", paid: true, date: new Date() },
      ],
      payments: [],
    } as never);

    const result = await getDebtorViewById("valid-id");
    expect(result!.totalOwed).toBe(200);
  });

  it("scopes the query to only publicly visible people", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Maria",
      debts: [],
      payments: [],
    } as never);

    await getDebtorViewById("some-id");
    expect(prismaMock.person.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "some-id", publicVisible: true } })
    );
  });
});

// ── togglePersonPublicVisibility ─────────────────────────────────────────────

describe("togglePersonPublicVisibility", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(togglePersonPublicVisibility(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when person does not belong to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);
    const form = new FormData();
    form.set("id", "person-1");
    await expect(togglePersonPublicVisibility(form)).rejects.toThrow("Person not found");
  });

  it("flips publicVisible from true to false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", publicVisible: true } as never);
    const form = new FormData();
    form.set("id", "person-1");
    await togglePersonPublicVisibility(form);
    expect(prismaMock.person.findFirst).toHaveBeenCalledWith({ where: { id: "person-1", userId: "user-1" } });
    expect(prismaMock.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { publicVisible: false },
    });
  });

  it("flips publicVisible from false to true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", publicVisible: false } as never);
    const form = new FormData();
    form.set("id", "person-1");
    await togglePersonPublicVisibility(form);
    expect(prismaMock.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { publicVisible: true },
    });
  });
});
