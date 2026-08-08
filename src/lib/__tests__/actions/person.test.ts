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
  getPersonByAccessCode,
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

  it("mints a random 12-char access code for the public page", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("name", "João");
    await createPerson(form);

    expect(prismaMock.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessCode: expect.stringMatching(/^[23456789A-HJKMNP-Z]{12}$/),
        }),
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
    form.set("accessCode", "CODE1");
    await deletePerson(form);
    expect((prismaMock.person as ExtendedPerson).deleteMany).toHaveBeenCalledWith({
      where: { accessCode: "CODE1", userId: "user-1" },
    });
  });

  it("throws when the access code is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deletePerson(new FormData())).rejects.toThrow();
  });

  it("scopes the delete to a different authenticated user's ownership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    const form = new FormData();
    form.set("accessCode", "CODE9");
    await deletePerson(form);
    expect((prismaMock.person as ExtendedPerson).deleteMany).toHaveBeenCalledWith({
      where: { accessCode: "CODE9", userId: "user-2" },
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
    form.set("accessCode", "CODE1");
    form.set("name", "Maria");
    await updatePerson(form);
    expect((prismaMock.person as ExtendedPerson).updateMany).toHaveBeenCalledWith({
      where: { accessCode: "CODE1", userId: "user-1" },
      data: { name: "Maria" },
    });
  });

  it("throws on empty name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("accessCode", "CODE1");
    form.set("name", "  ");
    await expect(updatePerson(form)).rejects.toThrow();
  });

  it("trims surrounding whitespace from the updated name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("accessCode", "CODE1");
    form.set("name", "  Maria  ");
    await updatePerson(form);
    expect((prismaMock.person as ExtendedPerson).updateMany).toHaveBeenCalledWith({
      where: { accessCode: "CODE1", userId: "user-1" },
      data: { name: "Maria" },
    });
  });

  it("throws when the access code is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("name", "Maria");
    await expect(updatePerson(form)).rejects.toThrow();
  });
});

// ── getPersonByAccessCode ────────────────────────────────────────────────────

describe("getPersonByAccessCode", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getPersonByAccessCode("any-id")).rejects.toThrow("Not authenticated");
  });

  it("returns null when not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);
    expect(await getPersonByAccessCode("x")).toBeNull();
  });

  it("looks the person up by accessCode, never by their DB id", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);

    await getPersonByAccessCode("CODE1");
    expect(prismaMock.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accessCode: "CODE1", userId: "user-1" } })
    );
  });

  it("never exposes the person's DB id to callers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      accessCode: "CODE1",
      name: "João",
      debts: [],
      payments: [],
    } as never);

    const result = await getPersonByAccessCode("CODE1");
    expect(result).not.toHaveProperty("id");
    expect(result!.accessCode).toBe("CODE1");
  });

  // Payments are never subtracted from totalOwed: marking a debt paid is the
  // only thing that clears it. See src/lib/balance.ts.
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

    const result = await getPersonByAccessCode("p1");
    expect(result!.totalOwed).toBe(400);
    expect(result!.totalPaid).toBe(100);
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

    const result = await getPersonByAccessCode("p1");
    expect(result!.totalOwed).toBe(100);
  });

  it("reports a payment with nothing owed without going negative", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      name: "Tati",
      debts: [],
      payments: [{ id: "pay1", amount: 300, date: new Date(), method: "PIX" }],
    } as never);

    const result = await getPersonByAccessCode("p1");
    expect(result!.totalOwed).toBe(0);
    expect(result!.totalPaid).toBe(300);
  });

  // The bug behind issue #5: an installment marked paid *and* its matching
  // payment registered used to deduct the same money twice, so an open debt
  // could still show up as R$ 0,00 owed.
  it("does not double-count an installment that is both paid and covered by a payment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      name: "Tati",
      debts: [
        { id: "d1", amount: 100, title: "1/2", description: "", paid: true, date: new Date() },
        { id: "d2", amount: 100, title: "2/2", description: "", paid: false, date: new Date() },
      ],
      payments: [{ id: "pay1", amount: 100, date: new Date(), method: "PIX" }],
    } as never);

    const result = await getPersonByAccessCode("p1");
    expect(result!.totalOwed).toBe(100);
    expect(result!.totalPaid).toBe(100);
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
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([
      { personId: "p1", _sum: { amount: 500 } },
    ] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people).toEqual([{ accessCode: "CODE1", name: "João" }]);
    expect(stats.totalToReceive).toBe(500);
    expect(stats.activeDebtors).toBe(1);
    expect(stats.totalDebtors).toBe(1);
    expect(stats.totalDebts).toBe(1);
    expect(stats.totalPayments).toBe(0);
    expect(stats.totalPaid).toBe(0);
  });

  it("counts a paid debt in totalDebts but excludes it from the balance", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    // paid: false in the groupBy's where filters the paid debt out entirely,
    // so it never contributes a _sum row — only the unfiltered count sees it.
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { stats } = await getDashboardOverview();
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalDebts).toBe(1);
  });

  // A 10x purchase is one thing the person bought, so totalDebts counts the
  // group once. The money aggregates stay row-based — each installment row
  // carries its own share.
  it("counts an installment group as a single debt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([{ personId: "p1", _sum: { amount: 785.91 } }] as never);
    // One standalone debt...
    prismaMock.debt.count.mockResolvedValue(1);
    // ...plus 10 rows collapsing to a single distinct group.
    prismaMock.debt.findMany.mockResolvedValue([{ installmentGroupId: "g1" }] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { stats } = await getDashboardOverview();
    expect(stats.totalDebts).toBe(2);
    expect(stats.totalToReceive).toBe(785.91);
  });

  // A debtor stops being active when their debts are marked paid — which the
  // groupBy's `paid: false` filter already takes care of — not when payments
  // happen to add up to the same figure.
  it("does not count a debtor whose debts are all marked paid as active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 300 }, _count: 1 } as never);

    const { stats } = await getDashboardOverview();
    expect(stats.totalToReceive).toBe(0);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalPaid).toBe(300);
  });

  // Same model as the person page: payments are reported on their own line,
  // never subtracted from what is still owed. Registering a payment without
  // marking the debt paid used to shrink totalToReceive here while the person
  // page still listed the debt as open.
  it("does not subtract payments from totalToReceive", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([{ personId: "p1", _sum: { amount: 200 } }] as never);
    prismaMock.debt.count.mockResolvedValue(1);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 300 }, _count: 1 } as never);

    const { stats } = await getDashboardOverview();
    expect(stats.totalToReceive).toBe(200);
    expect(stats.activeDebtors).toBe(1);
    expect(stats.totalPaid).toBe(300);
  });

  it("never queries payments grouped per person", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([] as never);
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(0);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    await getDashboardOverview();
    expect(prismaMock.payment.groupBy).not.toHaveBeenCalled();
  });

  it("returns a person with no debts/payments as not active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1", accessCode: "CODE1", name: "João" }] as never);
    prismaMock.debt.groupBy.mockResolvedValue([] as never);
    prismaMock.debt.count.mockResolvedValue(0);
    prismaMock.debt.findMany.mockResolvedValue([] as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 } as never);

    const { people, stats } = await getDashboardOverview();
    expect(people).toEqual([{ accessCode: "CODE1", name: "João" }]);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalToReceive).toBe(0);
  });
});

// ── getDebtorViewById ─────────────────────────────────────────────────────────

describe("getDebtorViewById", () => {
  it("returns null when the access code is not found", async () => {
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
    expect(result!.totalOwed).toBe(200);
    expect(result!.totalPaid).toBe(50);
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

  it("reports a payment with nothing owed on the public view too", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Tati",
      debts: [],
      payments: [{ id: "pay1", amount: 300, date: new Date(), method: "PIX" }],
    } as never);

    const result = await getDebtorViewById("valid-id");
    expect(result!.totalOwed).toBe(0);
    expect(result!.totalPaid).toBe(300);
  });

  it("looks the person up by accessCode, never by their DB id", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Maria",
      debts: [],
      payments: [],
    } as never);

    await getDebtorViewById("SOMEACCESSC0");
    expect(prismaMock.person.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accessCode: "SOMEACCESSC0", publicVisible: true } })
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
    form.set("accessCode", "CODE1");
    await expect(togglePersonPublicVisibility(form)).rejects.toThrow("Person not found");
  });

  it("flips publicVisible from true to false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1", publicVisible: true } as never);
    const form = new FormData();
    form.set("accessCode", "CODE1");
    await togglePersonPublicVisibility(form);
    expect(prismaMock.person.findFirst).toHaveBeenCalledWith({ where: { accessCode: "CODE1", userId: "user-1" } });
    expect(prismaMock.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { publicVisible: false },
    });
  });

  it("flips publicVisible from false to true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1", accessCode: "CODE1", publicVisible: false } as never);
    const form = new FormData();
    form.set("accessCode", "CODE1");
    await togglePersonPublicVisibility(form);
    expect(prismaMock.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { publicVisible: true },
    });
  });
});
