import {
  ApprovalStatus,
  BudgetState,
  BudgetType,
  SelectionStatus,
  type Prisma,
} from '@prisma/client'
import { prisma } from './db'
import { APPROVAL_STATEMENT } from './approval-statement'

export { APPROVAL_STATEMENT }

/**
 * RULE 3 LIVES HERE.
 *
 * An approval snapshots price at the moment of signing. It does not reference
 * a live price. Prices move between approval and order, and the record has to
 * show what she actually agreed to, not what the item costs today.
 *
 * So every money figure on ApprovalLine is a copied literal. `selectionId` is
 * kept for traceability and is never read to render a price. Nothing in this
 * module updates an existing approval: to change an approved room you sign a
 * new one, and the old record stands.
 */

export class NothingToApproveError extends Error {
  constructor(roomName: string) {
    super(`Nothing in ${roomName} is ready to approve. Every item needs a pick first.`)
    this.name = 'NothingToApproveError'
  }
}

export class UnchosenItemsError extends Error {
  readonly items: string[]
  constructor(items: string[]) {
    super(
      `These items still need a pick before the room can be approved: ${items.join(', ')}. ` +
        'A room is approved as a whole so the pieces are signed off against each other.',
    )
    this.name = 'UnchosenItemsError'
    this.items = items
  }
}

export type SignRoomInput = {
  roomId: string
  /** The signed-in user doing the signing. */
  userId: string
  /** Typed name at signing, kept verbatim next to the user id. */
  signedByName: string
}

/**
 * Signs off a room. Runs in one transaction so the snapshot, the status
 * changes and the budget commitments cannot drift apart.
 */
export async function signRoomApproval(input: SignRoomInput) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUniqueOrThrow({
      where: { id: input.roomId },
      include: {
        selections: { include: { chosenOption: true, options: true } },
      },
    })

    if (room.selections.length === 0) {
      throw new NothingToApproveError(room.name)
    }

    const unchosen = room.selections
      .filter((selection) => !selection.chosenOption)
      .map((selection) => selection.name)

    if (unchosen.length > 0) {
      throw new UnchosenItemsError(unchosen)
    }

    // Build the frozen lines. Every value below is read once, here, and copied.
    const lines: Prisma.ApprovalLineCreateManyApprovalInput[] = room.selections.map((selection) => {
      const option = selection.chosenOption!
      const lineTotalCents = option.priceCents * selection.qty

      return {
        selectionId: selection.id,
        selectionRef: selection.ref,
        itemName: selection.name,
        optionLabel: option.label,
        optionSlot: option.slot,
        vendor: option.vendor,
        qty: selection.qty,
        unitPriceCents: option.priceCents,
        lineTotalCents,
        leadTimeDays: option.leadTimeDays,
        dimensions: option.dimensions,
        nonReturnable: option.nonReturnable,
        // Goods are furnishing. The designer's own costs never enter a room
        // approval, which is part of how the two totals stay apart.
        budgetType: BudgetType.FURNISHING,
      }
    })

    const furnishingTotalCents = lines
      .filter((line) => line.budgetType === BudgetType.FURNISHING)
      .reduce((sum, line) => sum + line.lineTotalCents, 0)

    const expenseTotalCents = lines
      .filter((line) => line.budgetType === BudgetType.EXPENSE)
      .reduce((sum, line) => sum + line.lineTotalCents, 0)

    const approval = await tx.approval.create({
      data: {
        roomId: room.id,
        signedByUserId: input.userId,
        signedByName: input.signedByName,
        statementShown: APPROVAL_STATEMENT,
        furnishingTotalCents,
        expenseTotalCents,
        includedNonReturnable: lines.some((line) => line.nonReturnable),
        lines: { createMany: { data: lines } },
      },
      include: { lines: true },
    })

    await tx.room.update({
      where: { id: room.id },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    })

    await tx.selection.updateMany({
      where: { roomId: room.id },
      data: { status: SelectionStatus.APPROVED },
    })

    // Approving commits the money. The amount committed is the snapshot
    // amount, not a live price, for the same reason the snapshot exists.
    for (const line of approval.lines) {
      await tx.budgetLine.create({
        data: {
          projectId: room.projectId,
          roomId: room.id,
          selectionId: line.selectionId,
          type: line.budgetType,
          state: BudgetState.COMMITTED,
          label: `${line.itemName} (${line.optionLabel})`,
          vendor: line.vendor,
          amountCents: line.lineTotalCents,
          note: `Committed by approval signed ${approval.signedAt.toISOString().slice(0, 10)}.`,
        },
      })
    }

    return approval
  })
}

/** Approvals for a room, newest first. Read-only; approvals are never edited. */
export async function roomApprovals(roomId: string) {
  return prisma.approval.findMany({
    where: { roomId },
    orderBy: { signedAt: 'desc' },
    include: { lines: true, signedBy: true },
  })
}
