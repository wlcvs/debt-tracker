import { config } from "dotenv";
import path from "path";

// Load env before importing Prisma
config({ path: path.resolve(process.cwd(), ".env") });

import { Client } from "pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";

export const E2E_EMAIL = "e2e@debt-tracker.test";
export const E2E_PASSWORD = "e2etestpassword123";

export default async function globalSetup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Remove leftover test data from previous runs
    await client.query('DELETE FROM "User" WHERE email = $1', [E2E_EMAIL]);

    // Create test admin user
    const id = randomUUID();
    const passwordHash = await hash(E2E_PASSWORD, 12);
    await client.query(
      'INSERT INTO "User" (id, email, "passwordHash", "createdAt") VALUES ($1, $2, $3, now())',
      [id, E2E_EMAIL, passwordHash]
    );
  } finally {
    await client.end();
  }
}
