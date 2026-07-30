import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// pg-connection-string currently warns that sslmode=prefer/require/verify-ca
// are treated as aliases for verify-full, and will require the explicit mode
// in a future major version — only rewrite it when already present (Neon's
// URL sets one), so local dev (no sslmode, no TLS) is untouched.
function withVerifyFullSsl(url: string | undefined): string | undefined {
  if (!url) return url;
  return /sslmode=(prefer|require|verify-ca)\b/.test(url)
    ? url.replace(/sslmode=(prefer|require|verify-ca)\b/, "sslmode=verify-full")
    : url;
}

const adapter = new PrismaPg({ connectionString: withVerifyFullSsl(process.env.DATABASE_URL) });

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
