-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('STRIPE', 'RESEND');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "label" TEXT,
    "publicValue" TEXT,
    "secretCipher" TEXT,
    "secretHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckOk" BOOLEAN,
    "lastCheckNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_kind_key" ON "Integration"("kind");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
