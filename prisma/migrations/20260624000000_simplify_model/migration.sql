-- Drop PasswordResetToken table
DROP TABLE "PasswordResetToken";

-- Remove debtId from Payment
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_debtId_fkey";
ALTER TABLE "Payment" DROP COLUMN "debtId";

-- Remove Person.email unique index and column
DROP INDEX "Person_email_key";
ALTER TABLE "Person" DROP COLUMN "email";

-- Remove Person.passwordHash
ALTER TABLE "Person" DROP COLUMN "passwordHash";

-- Remove Person.phone
ALTER TABLE "Person" DROP COLUMN "phone";

-- Remove Person.emailNotifications
ALTER TABLE "Person" DROP COLUMN "emailNotifications";

-- Remove Person.accessCode unique index and column
DROP INDEX "Person_accessCode_key";
ALTER TABLE "Person" DROP COLUMN "accessCode";
