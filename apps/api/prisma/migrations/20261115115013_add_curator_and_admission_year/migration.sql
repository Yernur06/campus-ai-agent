-- DropIndex
DROP INDEX "AuditLog_actorId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_entityType_entityId_createdAt_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "admissionYear" INTEGER;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "curatorId" UUID;

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Student_curatorId_idx" ON "Student"("curatorId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
