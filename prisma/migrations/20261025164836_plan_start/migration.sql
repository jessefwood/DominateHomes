-- CreateTable
CREATE TABLE "PlanStart" (
    "email" TEXT NOT NULL,
    "closings2026" INTEGER NOT NULL,
    "listingSides" INTEGER NOT NULL DEFAULT 0,
    "buyerSides" INTEGER NOT NULL DEFAULT 0,
    "takeHomeCents" INTEGER NOT NULL,
    "databaseCount" INTEGER NOT NULL DEFAULT 0,
    "target2027" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanStart_pkey" PRIMARY KEY ("email")
);
