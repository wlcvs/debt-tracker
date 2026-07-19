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

  it("trims surrounding whitespace from the label", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.creditCard.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("label", "  Itaú  ");
    await createCreditCard(form);

    expect(prismaMock.creditCard.create).toHaveBeenCalledWith({
      data: { label: "Itaú", userId: "user-1" },
    });
  });

  it("throws when label is missing entirely", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(createCreditCard(new FormData())).rejects.toThrow();
  });

  it("scopes card creation to a different authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    prismaMock.creditCard.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("label", "Bradesco");
    await createCreditCard(form);

    expect(prismaMock.creditCard.create).toHaveBeenCalledWith({
      data: { label: "Bradesco", userId: "user-2" },
    });
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

  it("does not call creditCard.deleteMany when the card still has debts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.count.mockResolvedValue(1 as never);

    const form = new FormData();
    form.set("id", "card-1");
    await expect(deleteCreditCard(form)).rejects.toThrow();
    expect(prismaMock.creditCard.deleteMany).not.toHaveBeenCalled();
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deleteCreditCard(new FormData())).rejects.toThrow();
  });

  it("checks debt count by card id only, not scoped to the requesting user (pinning actual behavior)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.debt.count.mockResolvedValue(0 as never);
    prismaMock.creditCard.deleteMany.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("id", "card-1");
    await deleteCreditCard(form);

    expect(prismaMock.debt.count).toHaveBeenCalledWith({ where: { creditCardId: "card-1" } });
  });

  it("scopes the delete to a different authenticated user's ownership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    prismaMock.debt.count.mockResolvedValue(0 as never);
    prismaMock.creditCard.deleteMany.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("id", "card-9");
    await deleteCreditCard(form);

    expect(prismaMock.creditCard.deleteMany).toHaveBeenCalledWith({
      where: { id: "card-9", userId: "user-2" },
    });
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

  it("queries scoped to the user and ordered by label ascending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.creditCard.findMany.mockResolvedValue([]);

    await getCreditCards();

    expect(prismaMock.creditCard.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { label: "asc" },
    });
  });
});
