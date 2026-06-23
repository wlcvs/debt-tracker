-- AlterTable: opt-in flag for email notifications (default off)
ALTER TABLE "Person" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT false;
