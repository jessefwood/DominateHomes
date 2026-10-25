-- CreateEnum
CREATE TYPE "InviteRole" AS ENUM ('CLIENT', 'AGENT');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'HOMEWORK_TURNED_IN';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "role" "InviteRole" NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE "WorksheetAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorksheetAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkTurnIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "turnedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkTurnIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "courseSlug" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "presenterName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("courseSlug")
);

-- CreateIndex
CREATE INDEX "WorksheetAnswer_courseSlug_moduleKey_idx" ON "WorksheetAnswer"("courseSlug", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorksheetAnswer_userId_courseSlug_moduleKey_fieldKey_key" ON "WorksheetAnswer"("userId", "courseSlug", "moduleKey", "fieldKey");

-- CreateIndex
CREATE INDEX "HomeworkTurnIn_courseSlug_moduleKey_idx" ON "HomeworkTurnIn"("courseSlug", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkTurnIn_userId_courseSlug_moduleKey_key" ON "HomeworkTurnIn"("userId", "courseSlug", "moduleKey");

-- AddForeignKey
ALTER TABLE "WorksheetAnswer" ADD CONSTRAINT "WorksheetAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkTurnIn" ADD CONSTRAINT "HomeworkTurnIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
