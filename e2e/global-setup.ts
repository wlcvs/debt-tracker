import { config } from "dotenv";
import path from "path";

// Load env before importing Prisma
config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { hash } from "bcryptjs";

export const E2E_EMAIL = "e2e@debt-tracker.test";
export const E2E_PASSWORD = "e2etestpassword123";

export default async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    // Remove leftover test data from previous runs
    await prisma.user.deleteMany({ where: { email: E2E_EMAIL } });

    // Create test admin user
    await prisma.user.create({
      data: {
        email: E2E_EMAIL,
        passwordHash: await hash(E2E_PASSWORD, 12),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
