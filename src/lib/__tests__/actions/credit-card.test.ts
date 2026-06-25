import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { createCreditCard, deleteCreditCard, getCreditCards } from "@/lib/actions/credit-card";

const mockAuth = vi.mocked(auth);

beforeEach(() => vi.clearAllMocks());

// ── createCreditCard ──────────────────────────────────────────────────────────

describe("createCreditCard", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(createCreditCard(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("creates card scoped to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.creditCard.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("label", "Nubank");
    await createCreditCard(form);

    expect(prismaMock.creditCard.create).toHaveBeenCalledWith({
      data: { label: "Nubank", userId: "user-1" },
    });
  });

  it("throws on empty label", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("label", "  ");
    await expect(createCreditCard(form)).rejects.toThrow();
  });
});

// ── deleteCreditCard ──────────────────────────────────────────────────────────

describe("deleteCreditCard", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deleteCreditCard(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes card scoped to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.count.mockResolvedValue(0 as never);
    prismaMock.creditCard.deleteMany.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("id", "card-1");
    await deleteCreditCard(form);

    expect(prismaMock.creditCard.deleteMany).toHaveBeenCalledWith({
      where: { id: "card-1", userId: "user-1" },
    });
  });

  it("throws when card has debts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.count.mockResolvedValue(2 as never);

    const form = new FormData();
    form.set("id", "card-1");
    await expect(deleteCreditCard(form)).rejects.toThrow("dívidas registradas");
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deleteCreditCard(new FormData())).rejects.toThrow();
  });
});

// ── getCreditCards ────────────────────────────────────────────────────────────

describe("getCreditCards", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getCreditCards()).rejects.toThrow("Not authenticated");
  });

  it("returns cards for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.creditCard.findMany.mockResolvedValue([
      { id: "c1", label: "Inter", userId: "user-1" },
    ] as never);

    const result = await getCreditCards();
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Inter");
  });
});
