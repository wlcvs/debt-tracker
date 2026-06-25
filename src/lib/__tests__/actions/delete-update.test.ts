import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { deletePerson, updatePerson } from "@/lib/actions/person";
import { deleteDebt, updateDebt } from "@/lib/actions/debt";
import { deletePayment, updatePayment } from "@/lib/actions/payment";
import { deleteCreditCard } from "@/lib/actions/credit-card";

const mockAuth = vi.mocked(auth);

const extendedMock = prismaMock as typeof prismaMock & {
  person: typeof prismaMock.person & { deleteMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  debt: typeof prismaMock.debt & { deleteMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  payment: typeof prismaMock.payment & { deleteMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  creditCard: { deleteMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  extendedMock.person.deleteMany = vi.fn().mockResolvedValue({});
  extendedMock.person.updateMany = vi.fn().mockResolvedValue({});
  extendedMock.debt.deleteMany = vi.fn().mockResolvedValue({});
  extendedMock.debt.updateMany = vi.fn().mockResolvedValue({});
  extendedMock.payment.deleteMany = vi.fn().mockResolvedValue({});
  extendedMock.payment.updateMany = vi.fn().mockResolvedValue({});
  extendedMock.creditCard = { deleteMany: vi.fn().mockResolvedValue({}) };
});

// ── deletePerson ────────────────────────────────────────────────────────────

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
    expect(extendedMock.person.deleteMany).toHaveBeenCalledWith({
      where: { id: "person-1", userId: "user-1" },
    });
  });
});

// ── updatePerson ────────────────────────────────────────────────────────────

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
    expect(extendedMock.person.updateMany).toHaveBeenCalledWith({
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
});

// ── deleteDebt ──────────────────────────────────────────────────────────────

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
    expect(extendedMock.debt.deleteMany).toHaveBeenCalledWith({
      where: { id: "debt-1", person: { userId: "user-1" } },
    });
  });
});

// ── updateDebt ──────────────────────────────────────────────────────────────

describe("updateDebt", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(updateDebt(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("updates debt fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "debt-1");
    form.set("amount", "200");
    form.set("description", "Jantar atualizado");
    form.set("date", "2025-05-01");
    await updateDebt(form);
    expect(extendedMock.debt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "debt-1", person: { userId: "user-1" } },
        data: expect.objectContaining({ amount: 200, description: "Jantar atualizado" }),
      })
    );
  });
});

// ── deletePayment ───────────────────────────────────────────────────────────

describe("deletePayment", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deletePayment(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes payment scoped to user via person", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "pay-1");
    await deletePayment(form);
    expect(extendedMock.payment.deleteMany).toHaveBeenCalledWith({
      where: { id: "pay-1", person: { userId: "user-1" } },
    });
  });
});

// ── updatePayment ───────────────────────────────────────────────────────────

describe("updatePayment", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(updatePayment(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("updates payment fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "pay-1");
    form.set("amount", "300");
    form.set("date", "2025-06-01");
    await updatePayment(form);
    expect(extendedMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", person: { userId: "user-1" } },
        data: expect.objectContaining({ amount: 300 }),
      })
    );
  });
});

// ── deleteCreditCard ────────────────────────────────────────────────────────

describe("deleteCreditCard", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deleteCreditCard(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("deletes card scoped to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("id", "card-1");
    await deleteCreditCard(form);
    expect(extendedMock.creditCard.deleteMany).toHaveBeenCalledWith({
      where: { id: "card-1", userId: "user-1" },
    });
  });
});
