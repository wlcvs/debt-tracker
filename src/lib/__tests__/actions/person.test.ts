import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import {
  createPerson,
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

  it("creates person with only name", async () => {
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
        debts: [{ id: "d1", amount: 500, description: "X", date: new Date() }],
        payments: [{ id: "pay1", amount: 200, date: new Date(), method: "PIX" }],
      },
    ] as never);

    const result = await getPeopleWithBalances();
    expect(result).toHaveLength(1);
    expect(result[0].totalOwed).toBe(300);
    expect(result[0].name).toBe("João");
  });
});
