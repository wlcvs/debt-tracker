import { vi } from "vitest";

export const prismaMock = {
  person: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  debt: {
    create: vi.fn(),
    count: vi.fn(),
  },
  payment: {
    create: vi.fn(),
  },
  creditCard: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
