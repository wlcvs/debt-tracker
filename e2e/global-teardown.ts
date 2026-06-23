import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { Client } from "pg";
import { E2E_EMAIL } from "./global-setup";

export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Cascade deletes all associated data (people, debts, payments)
    await client.query('DELETE FROM "User" WHERE email = $1', [E2E_EMAIL]);
  } finally {
    await client.end();
  }
}
