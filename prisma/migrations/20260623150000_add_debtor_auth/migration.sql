-- AlterTable: add debtor authentication fields to Person
ALTER TABLE "Person" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Person" ADD COLUMN "phone" TEXT;

-- CreateIndex: unique email for debtor login (NULLs are allowed in unique index)
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
