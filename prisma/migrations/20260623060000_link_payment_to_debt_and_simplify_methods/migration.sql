-- Convert any CREDIT_CARD payments to CASH before removing the enum value
UPDATE "Payment" SET "method" = 'CASH' WHERE "method" = 'CREDIT_CARD';

-- Add debtId column to Payment
ALTER TABLE "Payment" ADD COLUMN "debtId" TEXT;

-- Recreate PaymentMethod enum without CREDIT_CARD
-- Drop the default first so it doesn't block the type change
ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH');
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING "method"::text::"PaymentMethod";
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'CASH'::"PaymentMethod";
DROP TYPE "PaymentMethod_old";

-- Add foreign key from Payment.debtId to Debt.id
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_debtId_fkey"
  FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
