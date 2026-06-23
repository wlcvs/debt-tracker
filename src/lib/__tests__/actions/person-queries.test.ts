import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { getPersonById, getOverviewStats, getDebtorViewByCode } from "@/lib/actions/person";

const mockAuth = vi.mocked(auth);

beforeEach(() => vi.clearAllMocks());

// ── getPersonById ───────────────────────────────────────────────────────────

describe("getPersonById", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getPersonById("any-id")).rejects.toThrow("Not authenticated");
  });

  it("returns null when person not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);
    const result = await getPersonById("nonexistent");
    expect(result).toBeNull();
  });

  it("returns person with balance and covered debts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({
      id: "p1",
      name: "João",
      accessCode: "abc123",
      debts: [
        { id: "d1", amount: 100, description: "X", date: new Date("2025-01-01") },
        { id: "d2", amount: 300, description: "Y", date: new Date("2025-01-02") },
      ],
      payments: [{ id: "pay1", amount: 100, date: new Date() }],
    });

    const result = await getPersonById("p1");
    expect(result).not.toBeNull();
    expect(result!.totalOwed).toBe(300); // 400 - 100
    // d1 (100) is covered by 100 payment; d2 (300) is not
    expect(result!.debts.find((d) => d.id === "d1")!.isCovered).toBe(true);
    expect(result!.debts.find((d) => d.id === "d2")!.isCovered).toBe(false);
  });
});

// ── getOverviewStats ────────────────────────────────────────────────────────

describe("getOverviewStats", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getOverviewStats()).rejects.toThrow("Not authenticated");
  });

  it("returns correct aggregate stats", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([
      {
        id: "p1",
        debts: [{ amount: 500 }, { amount: 200 }],
        payments: [{ amount: 100 }],
      },
      {
        id: "p2",
        debts: [{ amount: 300 }],
        payments: [{ amount: 300 }], // fully paid
      },
    ] as never);

    const stats = await getOverviewStats();
    expect(stats.totalToReceive).toBe(600); // (700-100) + (300-300 = 0)
    expect(stats.activeDebtors).toBe(1);    // only p1 still owes
    expect(stats.totalDebtors).toBe(2);
    expect(stats.totalDebts).toBe(3);
    expect(stats.totalPayments).toBe(2);
    expect(stats.totalPaid).toBe(400);
  });

  it("returns zeros when no people exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findMany.mockResolvedValue([]);

    const stats = await getOverviewStats();
    expect(stats.totalToReceive).toBe(0);
    expect(stats.activeDebtors).toBe(0);
    expect(stats.totalDebtors).toBe(0);
  });
});

// ── getDebtorViewByCode ─────────────────────────────────────────────────────

describe("getDebtorViewByCode", () => {
  it("returns null when code not found", async () => {
    prismaMock.person.findUnique.mockResolvedValue(null);
    const result = await getDebtorViewByCode("bad-code");
    expect(result).toBeNull();
  });

  it("returns debtor view with correct balance", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "Maria",
      debts: [{ id: "d1", amount: 200, description: "X", date: new Date() }],
      payments: [{ id: "pay1", amount: 50, date: new Date() }],
    } as never);

    const result = await getDebtorViewByCode("valid-code");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Maria");
    expect(result!.totalOwed).toBe(150);
  });
});
