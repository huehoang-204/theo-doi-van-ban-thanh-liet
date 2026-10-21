-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "commentId" TEXT;

-- AlterTable
ALTER TABLE "DocumentNode" ADD COLUMN     "publishMessage" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "recipientAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipientDepartmentIds" TEXT[];

-- AlterTable
ALTER TABLE "DocumentShare" ADD COLUMN     "direct" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DocumentView" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentView_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentView_userId_idx" ON "DocumentView"("userId");

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_createdAt_idx" ON "DocumentComment"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");

-- CreateIndex
CREATE INDEX "DocumentNode_publishedAt_idx" ON "DocumentNode"("publishedAt");

-- AddForeignKey
ALTER TABLE "DocumentNode" ADD CONSTRAINT "DocumentNode_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DocumentComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Văn bản đã có: danh sách đơn vị nhận rỗng (không để NULL)
UPDATE "DocumentNode" SET "recipientDepartmentIds" = '{}' WHERE "recipientDepartmentIds" IS NULL;
