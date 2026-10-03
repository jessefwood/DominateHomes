-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('CLIENT', 'DESIGNER');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SIGN_IN_REQUESTED', 'SIGNED_IN', 'SIGNED_OUT', 'ACCESS_OPENED', 'ACCESS_CLOSED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'ACCESS_REQUESTED', 'ACCESS_APPROVED', 'ACCESS_DECLINED', 'FILE_UPLOADED', 'FILE_DELETED', 'FILE_RESTORED', 'MESSAGE_SENT');

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "roomId" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "source" "UploadSource" NOT NULL,
    "caption" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT,
    "label" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readByClientAt" TIMESTAMP(3),
    "readByDesignerAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "projectId" TEXT,
    "summary" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_storageKey_key" ON "Upload"("storageKey");

-- CreateIndex
CREATE INDEX "Upload_projectId_deletedAt_createdAt_idx" ON "Upload"("projectId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_roomId_idx" ON "Upload"("roomId");

-- CreateIndex
CREATE INDEX "Upload_uploadedById_idx" ON "Upload"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_projectId_idx" ON "Invite"("projectId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");

-- CreateIndex
CREATE INDEX "Message_projectId_deletedAt_createdAt_idx" ON "Message"("projectId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
