-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'DESIGNER');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('DIRECTION', 'SELECTIONS', 'APPROVALS', 'ORDERING', 'DELIVERY', 'INSTALL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RoomTier" AS ENUM ('MAJOR', 'LIGHT', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_READY', 'READY_FOR_APPROVAL', 'APPROVED');

-- CreateEnum
CREATE TYPE "OptionSlot" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('PENDING', 'CHOSEN', 'APPROVED', 'ORDERED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FURNISHING', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetState" AS ENUM ('PLANNED', 'COMMITTED', 'SPENT');

-- CreateEnum
CREATE TYPE "KeepStatus" AS ENUM ('KEEP', 'RELEASE', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "ArtDecision" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ReframeStatus" AS ENUM ('NOT_NEEDED', 'APPROVED_TO_REFRAME', 'AT_FRAMER', 'DONE');

-- CreateEnum
CREATE TYPE "OpenItemOwner" AS ENUM ('CLIENT', 'DESIGNER');

-- CreateEnum
CREATE TYPE "OpenItemStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ORDERED', 'ACKNOWLEDGED', 'IN_TRANSIT', 'RECEIVED', 'DAMAGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "addressLine" TEXT,
    "community" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "acSqFt" INTEGER NOT NULL,
    "totalSqFt" INTEGER NOT NULL,
    "phase" "Phase" NOT NULL,
    "clientName" TEXT NOT NULL,
    "designer" TEXT NOT NULL,
    "allocationCents" INTEGER NOT NULL,
    "earliestCloseOn" TIMESTAMP(3),
    "installAfterOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "widthFt" INTEGER,
    "lengthFt" INTEGER,
    "tier" "RoomTier" NOT NULL,
    "rugSize" TEXT,
    "budgetLowCents" INTEGER NOT NULL,
    "budgetMidCents" INTEGER NOT NULL,
    "budgetHighCents" INTEGER NOT NULL,
    "contents" TEXT NOT NULL,
    "constraintNote" TEXT,
    "unresolvedNote" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_READY',

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status" "SelectionStatus" NOT NULL DEFAULT 'PENDING',
    "chosenSlot" "OptionSlot",
    "chosenAt" TIMESTAMP(3),

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionOption" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "slot" "OptionSlot" NOT NULL,
    "label" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "leadTimeDays" INTEGER,
    "dimensions" TEXT,
    "photoUrl" TEXT,
    "productUrl" TEXT,
    "colorway" TEXT,
    "nonReturnable" BOOLEAN NOT NULL DEFAULT false,
    "pricedLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedByUserId" TEXT NOT NULL,
    "signedByName" TEXT NOT NULL,
    "statementShown" TEXT NOT NULL,
    "furnishingTotalCents" INTEGER NOT NULL,
    "expenseTotalCents" INTEGER NOT NULL,
    "includedNonReturnable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLine" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "selectionId" TEXT,
    "selectionRef" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "optionLabel" TEXT NOT NULL,
    "optionSlot" "OptionSlot" NOT NULL,
    "vendor" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,
    "leadTimeDays" INTEGER,
    "dimensions" TEXT,
    "nonReturnable" BOOLEAN NOT NULL,
    "budgetType" "BudgetType" NOT NULL,

    CONSTRAINT "ApprovalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "selectionId" TEXT,
    "type" "BudgetType" NOT NULL,
    "state" "BudgetState" NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "vendor" TEXT,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "incurredOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReusePiece" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inventoryNo" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dimensions" TEXT,
    "measurementsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "photoUrl" TEXT,
    "status" "KeepStatus" NOT NULL DEFAULT 'UNDECIDED',
    "scenarioDependent" BOOLEAN NOT NULL DEFAULT false,
    "destinationRoomId" TEXT,
    "replacementLowCents" INTEGER,
    "replacementHighCents" INTEGER,
    "treatmentNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusePiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtPiece" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "medium" TEXT,
    "widthIn" INTEGER,
    "heightIn" INTEGER,
    "sizeLabel" TEXT,
    "sizeConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "decision" "ArtDecision" NOT NULL,
    "reframeStatus" "ReframeStatus" NOT NULL DEFAULT 'NOT_NEEDED',
    "frameFinish" TEXT,
    "needsStudsOrCleat" BOOLEAN NOT NULL DEFAULT false,
    "destinationRoomId" TEXT,
    "wallNote" TEXT,

    CONSTRAINT "ArtPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "owner" "OpenItemOwner" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "order" INTEGER NOT NULL,
    "status" "OpenItemStatus" NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredByUserId" TEXT,
    "blocksOrdering" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpenItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "order" INTEGER NOT NULL,
    "occursOn" TIMESTAMP(3),
    "dateLabel" TEXT NOT NULL,
    "isDeadline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDERED',
    "orderedPriceCents" INTEGER NOT NULL,
    "acknowledgedPriceCents" INTEGER,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "etaAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "deliverTo" TEXT,
    "note" TEXT,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Room_projectId_order_idx" ON "Room"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Room_projectId_slug_key" ON "Room"("projectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_ref_key" ON "Selection"("ref");

-- CreateIndex
CREATE INDEX "Selection_roomId_idx" ON "Selection"("roomId");

-- CreateIndex
CREATE INDEX "Selection_status_idx" ON "Selection"("status");

-- CreateIndex
CREATE INDEX "SelectionOption_selectionId_idx" ON "SelectionOption"("selectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SelectionOption_selectionId_slot_key" ON "SelectionOption"("selectionId", "slot");

-- CreateIndex
CREATE INDEX "Approval_roomId_signedAt_idx" ON "Approval"("roomId", "signedAt");

-- CreateIndex
CREATE INDEX "ApprovalLine_approvalId_idx" ON "ApprovalLine"("approvalId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_type_state_idx" ON "BudgetLine"("projectId", "type", "state");

-- CreateIndex
CREATE INDEX "BudgetLine_roomId_idx" ON "BudgetLine"("roomId");

-- CreateIndex
CREATE INDEX "ReusePiece_projectId_status_idx" ON "ReusePiece"("projectId", "status");

-- CreateIndex
CREATE INDEX "ArtPiece_projectId_decision_idx" ON "ArtPiece"("projectId", "decision");

-- CreateIndex
CREATE INDEX "OpenItem_projectId_owner_order_idx" ON "OpenItem"("projectId", "owner", "order");

-- CreateIndex
CREATE INDEX "Milestone_projectId_order_idx" ON "Milestone"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_selectionId_key" ON "PurchaseOrder"("selectionId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_id_chosenSlot_fkey" FOREIGN KEY ("id", "chosenSlot") REFERENCES "SelectionOption"("selectionId", "slot") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionOption" ADD CONSTRAINT "SelectionOption_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLine" ADD CONSTRAINT "ApprovalLine_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLine" ADD CONSTRAINT "ApprovalLine_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusePiece" ADD CONSTRAINT "ReusePiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusePiece" ADD CONSTRAINT "ReusePiece_destinationRoomId_fkey" FOREIGN KEY ("destinationRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtPiece" ADD CONSTRAINT "ArtPiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtPiece" ADD CONSTRAINT "ArtPiece_destinationRoomId_fkey" FOREIGN KEY ("destinationRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenItem" ADD CONSTRAINT "OpenItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenItem" ADD CONSTRAINT "OpenItem_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
