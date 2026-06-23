import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { createDebt } from "@/lib/actions/debt";

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

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
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" });
    prismaMock.debt.create.mockResolvedValue({});

    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "150");
    form.set("description", "Jantar");
    form.set("date", "2025-03-10");

    await createDebt(form);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: "person-1",
          amount: 150,
          description: "Jantar",
        }),
      })
    );
  });

  it("throws on invalid amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "-50");
    form.set("description", "X");
    form.set("date", "2025-01-01");

    await expect(createDebt(form)).rejects.toThrow();
  });
});
