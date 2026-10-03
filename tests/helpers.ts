import { BudgetState, BudgetType, Phase, PrismaClient, Role, RoomTier } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

export async function reset() {
  // The chosen-option foreign key is RESTRICT, so choices have to be cleared
  // before the options they point at can be deleted.
  await prisma.selection.updateMany({ data: { chosenSlot: null, chosenAt: null } })

  await prisma.$transaction([
    prisma.approvalLine.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.budgetLine.deleteMany(),
    prisma.selectionOption.deleteMany(),
    prisma.selection.deleteMany(),
    prisma.artPiece.deleteMany(),
    prisma.reusePiece.deleteMany(),
    prisma.openItem.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.room.deleteMany(),
    prisma.project.deleteMany(),
    prisma.session.deleteMany(),
    prisma.loginToken.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

export async function fixture() {
  const user = await prisma.user.create({
    data: { email: `client-${Date.now()}@example.invalid`, name: 'Test Client', role: Role.CLIENT },
  })

  const project = await prisma.project.create({
    data: {
      slug: `p-${Date.now()}`,
      displayName: '643 Bianca',
      community: 'Test',
      planName: 'Bianca',
      acSqFt: 2799,
      totalSqFt: 3599,
      phase: Phase.SELECTIONS,
      clientName: 'Test Client',
      designer: 'Davina Hughes',
      allocationCents: 4_700_000,
    },
  })

  const room = await prisma.room.create({
    data: {
      projectId: project.id,
      name: 'Great Room',
      slug: 'great-room',
      order: 1,
      tier: RoomTier.MAJOR,
      budgetLowCents: 310_000,
      budgetMidCents: 360_000,
      budgetHighCents: 1_030_000,
      contents: 'Sofa, chairs, tables',
    },
  })

  const selection = await prisma.selection.create({
    data: { roomId: room.id, ref: `REF-${Date.now()}`, name: 'Sofa', category: 'Seating' },
  })

  return { user, project, room, selection }
}

export const option = (label: string, priceCents: number) => ({
  label,
  vendor: 'Wayfair',
  priceCents,
})

export async function planFurnishing(projectId: string, amountCents: number) {
  return prisma.budgetLine.create({
    data: {
      projectId,
      type: BudgetType.FURNISHING,
      state: BudgetState.PLANNED,
      label: 'Room allocation',
      amountCents,
    },
  })
}

export async function planExpense(projectId: string, amountCents: number) {
  return prisma.budgetLine.create({
    data: {
      projectId,
      type: BudgetType.EXPENSE,
      state: BudgetState.PLANNED,
      label: 'Design fee',
      amountCents,
    },
  })
}
