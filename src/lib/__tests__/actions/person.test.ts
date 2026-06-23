import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

import { auth } from "@/auth";
import {
  createPerson,
  getPersonByAccessCode,
  getPeopleWithBalances,
} from "@/lib/actions/person";

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createPerson ────────────────────────────────────────────────────────────

describe("createPerson", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const form = new FormData();
    form.set("name", "João");
    await expect(createPerson(form)).rejects.toThrow("Not authenticated");
  });

  it("creates person with generated accessCode", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.create.mockResolvedValue({});

    const form = new FormData();
    form.set("name", "João");
    await createPerson(form);

    expect(prismaMock.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "João",
          userId: "user-1",
          accessCode: expect.any(String),
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
});

// ── getPersonByAccessCode ───────────────────────────────────────────────────

describe("getPersonByAccessCode", () => {
  const idle = { status: "idle" as const };

  it("returns error when code is empty", async () => {
    const form = new FormData();
    const result = await getPersonByAccessCode(idle, form);
    expect(result).toMatchObject({ status: "error" });
  });

  it("returns error when code is not found", async () => {
    prismaMock.person.findUnique.mockResolvedValue(null);
    const form = new FormData();
    form.set("accessCode", "abc123");
    const result = await getPersonByAccessCode(idle, form);
    expect(result).toMatchObject({ status: "error", message: "Código não encontrado." });
  });

  it("returns debtor view with covered debts on success", async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      name: "João",
      debts: [
        { id: "d1", amount: 100, description: "Almoço", date: new Date("2025-01-01") },
        { id: "d2", amount: 200, description: "Cinema", date: new Date("2025-01-02") },
      ],
      payments: [{ id: "p1", amount: 100, date: new Date("2025-02-01") }],
    });

    const form = new FormData();
    form.set("accessCode", "valid-code");
    const result = await getPersonByAccessCode(idle, form);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.debtor.totalOwed).toBe(200); // 300 - 100
    const covered = result.debtor.debts.filter((d) => d.isCovered);
    expect(covered).toHaveLength(1);
    expect(covered[0].id).toBe("d1"); // menor dívida coberta primeiro
  });
});

// ── getPeopleWithBalances ───────────────────────────────────────────────────

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
        accessCode: "abc",
        debts: [{ id: "d1", amount: 500, description: "X", date: new Date() }],
        payments: [{ id: "pay1", amount: 200, date: new Date() }],
      },
    ]);

    const result = await getPeopleWithBalances();
    expect(result).toHaveLength(1);
    expect(result[0].totalOwed).toBe(300);
    expect(result[0].name).toBe("João");
  });
});
