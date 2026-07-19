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
  getPeopleWithBalances,
  getPersonById,
  getOverviewStats,
  getDebtorViewById,
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

// ── getPeopleWithBalances ─────────────────────────────────────────────────────

describe("getPeopleWithBalances", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getPeopleWithBalances()).rejects.toThrow("Not authenticated");
  });

  it("returns people with correct totalOwed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "João",
        debts: [{ id: "d1", amount: 500, description: "X", date: new Date() }],
        payments: [{ id: "pay1", amount: 200, date: new Date(), method: "PIX" }],
      },
    ] as never);

    const result = await getPeopleWithBalances();
    expect(result).toHaveLength(1);
    expect(result[0].totalOwed).toBe(300);
    expect(result[0].name).toBe("João");
  });

  it("excludes paid debts from totalOwed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "João",
        debts: [
          { id: "d1", amount: 500, title: "X", description: "", paid: false, date: new Date() },
          { id: "d2", amount: 1000, title: "Y", description: "", paid: true, date: new Date() },
        ],
        payments: [],
      },
    ] as never);

    const result = await getPeopleWithBalances();
    expect(result[0].totalOwed).toBe(500);
  });

  it("excludes a paid debt that belongs to an installment group from totalOwed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "João",
        debts: [
          {
            id: "d1",
            amount: 100,
            title: "Notebook (1/2)",
            description: "",
            paid: true,
            date: new Date(),
            installmentGroupId: "group-1",
            installmentIndex: 1,
            installmentTotal: 2,
          },
          {
            id: "d2",
            amount: 100,
            title: "Notebook (2/2)",
            description: "",
            paid: false,
            date: new Date(),
            installmentGroupId: "group-1",
            installmentIndex: 2,
            installmentTotal: 2,
          },
        ],
        payments: [],
      },
    ] as never);

    const result = await getPeopleWithBalances();
    expect(result[0].totalOwed).toBe(100);
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

// ── getOverviewStats ──────────────────────────────────────────────────────────

describe("getOverviewStats", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getOverviewStats()).rejects.toThrow("Not authenticated");
  });

  it("returns correct aggregate stats", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      { id: "p1", debts: [{ amount: 500 }, { amount: 200 }], payments: [{ amount: 100 }] },
      { id: "p2", debts: [{ amount: 300 }], payments: [{ amount: 300 }] },
    ] as never);

    const stats = await getOverviewStats();
    expect(stats.totalToReceive).toBe(600);
    expect(stats.activeDebtors).toBe(1);
    expect(stats.totalDebtors).toBe(2);
    expect(stats.totalDebts).toBe(3);
    expect(stats.totalPayments).toBe(2);
    expect(stats.totalPaid).toBe(400);
  });

  it("returns zeros with no people", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([]);
    const stats = await getOverviewStats();
    expect(stats.totalToReceive).toBe(0);
    expect(stats.activeDebtors).toBe(0);
  });

  it("clamps a negative owed balance (overpayment) to 0 in totalToReceive without counting them as an active debtor", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      { id: "p1", debts: [{ amount: 100, paid: false }], payments: [{ amount: 300 }] },
    ] as never);

    const stats = await getOverviewStats();
    expect(stats.totalToReceive).toBe(0);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalPaid).toBe(300);
  });

  it("does not count a debtor with exactly zero balance owed as active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      { id: "p1", debts: [{ amount: 200, paid: false }], payments: [{ amount: 200 }] },
    ] as never);

    const stats = await getOverviewStats();
    expect(stats.activeDebtors).toBe(0);
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
});
