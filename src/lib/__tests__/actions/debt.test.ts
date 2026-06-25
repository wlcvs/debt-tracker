import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { createDebt, deleteDebt, updateDebt } from "@/lib/actions/debt";

const mockAuth = vi.mocked(auth);

type ExtendedDebt = typeof prismaMock.debt & {
  deleteMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  (prismaMock.debt as ExtendedDebt).deleteMany = vi.fn().mockResolvedValue({});
  (prismaMock.debt as ExtendedDebt).updateMany = vi.fn().mockResolvedValue({});
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
    form.set("description", "Almoço");
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
    form.set("description", "Jantar");
    form.set("date", "2025-03-10");

    await createDebt(form);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ personId: "person-1", amount: 150, description: "Jantar" }),
      })
    );
  });

  it("throws on non-positive amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "-50");
    form.set("description", "X");
    form.set("date", "2025-01-01");
    await expect(createDebt(form)).rejects.toThrow();
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
    expect((prismaMock.debt as ExtendedDebt).deleteMany).toHaveBeenCalledWith({
      where: { id: "debt-1", person: { userId: "user-1" } },
    });
  });

  it("throws when id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    await expect(deleteDebt(new FormData())).rejects.toThrow();
  });
});

// ── updateDebt ────────────────────────────────────────────────────────────────

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
    expect((prismaMock.debt as ExtendedDebt).updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "debt-1", person: { userId: "user-1" } },
        data: expect.objectContaining({ amount: 200, description: "Jantar atualizado" }),
      })
    );
  });
});
