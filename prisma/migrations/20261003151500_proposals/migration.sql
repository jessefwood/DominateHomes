-- CreateEnum
CREATE TYPE "ProposalTier" AS ENUM ('LEAN', 'RECOMMENDED', 'ELEVATED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ProposalScopeKind" AS ENUM ('INCLUDED', 'NOT_INCLUDED', 'CLIENT_OWNED');

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tier" "ProposalTier" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedForLabel" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "furnishingsSubtotalCents" INTEGER NOT NULL,
    "taxRateBasisPoints" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "freightRateBasisPoints" INTEGER NOT NULL,
    "freightCents" INTEGER NOT NULL,
    "goodsDeliveredCents" INTEGER NOT NULL,
    "designFeeRateBasisPoints" INTEGER NOT NULL,
    "feesAndExpensesCents" INTEGER NOT NULL,
    "issuedOn" TIMESTAMP(3),
    "validUntilOn" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedByName" TEXT,
    "acceptedByUserId" TEXT,
    "statementShown" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declineNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalLine" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "type" "BudgetType" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProposalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalPayment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "whenLabel" TEXT NOT NULL,
    "detail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidRef" TEXT,

    CONSTRAINT "ProposalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalScopeItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "kind" "ProposalScopeKind" NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProposalScopeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_number_key" ON "Proposal"("number");

-- CreateIndex
CREATE INDEX "Proposal_projectId_status_idx" ON "Proposal"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProposalLine_proposalId_idx" ON "ProposalLine"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalPayment_proposalId_idx" ON "ProposalPayment"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalScopeItem_proposalId_idx" ON "ProposalScopeItem"("proposalId");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalLine" ADD CONSTRAINT "ProposalLine_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalPayment" ADD CONSTRAINT "ProposalPayment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalScopeItem" ADD CONSTRAINT "ProposalScopeItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
