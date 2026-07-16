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
    createMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  payment: {
    create: vi.fn(),
  },
  creditCard: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  statement: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  lLMFeedback: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") return arg(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
