-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "installmentGroupId" TEXT,
ADD COLUMN     "installmentIndex" INTEGER,
ADD COLUMN     "installmentTotal" INTEGER;

-- CreateIndex
CREATE INDEX "Debt_installmentGroupId_idx" ON "Debt"("installmentGroupId");
