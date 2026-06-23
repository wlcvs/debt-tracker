import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { E2E_EMAIL } from "./global-setup";

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  try {
    // Cascade deletes all associated data (people, debts, payments)
    await prisma.user.deleteMany({ where: { email: E2E_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}
