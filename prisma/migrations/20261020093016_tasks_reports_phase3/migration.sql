-- DropIndex
DROP INDEX "ReportSubmission_periodId_idx";

-- AlterTable
ALTER TABLE "DocumentNode" ALTER COLUMN "progressCache" DROP NOT NULL,
ALTER COLUMN "progressCache" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportRequirement" ADD COLUMN     "autoCreateChild" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ReportSubmission" DROP COLUMN "lockedAt",
ADD COLUMN     "unlockedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskUpdate" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'PROGRESS';

-- CreateIndex
CREATE UNIQUE INDEX "ReportSubmission_periodId_key" ON "ReportSubmission"("periodId");


-- Giá trị tiến độ cũ (mặc định 0) không có nghĩa → để null, tính lại bằng recomputeTree
UPDATE "DocumentNode" SET "progressCache" = NULL;
