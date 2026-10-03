-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "showOnSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "siteSummary" TEXT;

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
