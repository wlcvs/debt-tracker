import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import { createPayment } from "@/lib/actions/payment";

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPayment", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(createPayment(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when person does not belong to user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue(null);

    const form = new FormData();
    form.set("personId", "person-99");
    form.set("amount", "100");
    form.set("date", "2025-01-01");

    await expect(createPayment(form)).rejects.toThrow("Person not found");
  });

  it("creates payment for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.person.findFirst.mockResolvedValue({ id: "person-1" } as never);
    prismaMock.payment.create.mockResolvedValue({} as never);

    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "250");
    form.set("date", "2025-04-01");

    await createPayment(form);

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: "person-1",
          amount: 250,
        }),
      })
    );
  });

  it("throws on non-positive amount", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const form = new FormData();
    form.set("personId", "person-1");
    form.set("amount", "0");
    form.set("date", "2025-01-01");

    await expect(createPayment(form)).rejects.toThrow();
  });
});
