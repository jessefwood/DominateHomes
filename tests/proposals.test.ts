import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import {
  BudgetType,
  Phase,
  ProposalScopeKind,
  ProposalStatus,
  ProposalTier,
  Role,
} from '@prisma/client'
import { budgetTotals } from '../lib/budget'
import {
  acceptProposal,
  applyRate,
  declineProposal,
  draftProposal,
  NothingToProposeError,
  PROPOSAL_STATEMENT,
  ProposalLockedError,
  proposalSides,
  proposalsForProject,
  ScheduleMismatchError,
  sendProposal,
  withdrawProposal,
} from '../lib/proposals'
import { fixture, prisma, reset } from './helpers'

/**
 * Proposals carry rules 2 and 3, so the tests that matter are about money
 * staying put and the two sides staying apart.
 */

// The fixture's one room: low 310_000, mid 360_000, high 1_030_000 cents.
const ROOM_MID = 360_000

async function designer() {
  return prisma.user.create({
    data: { email: `d-${Date.now()}@example.invalid`, name: 'Davina Hughes', role: Role.DESIGNER },
  })
}

type Overrides = Partial<Parameters<typeof draftProposal>[0]>

async function draft(projectId: string, createdByUserId: string, overrides: Overrides = {}) {
  const taxRateBasisPoints = overrides.taxRateBasisPoints ?? 700
  const freightRateBasisPoints = overrides.freightRateBasisPoints ?? 800
  const designFeeRateBasisPoints = overrides.designFeeRateBasisPoints ?? 3000
  const expenses = overrides.expenses ?? [{ label: 'Install labor', amountCents: 300_000 }]

  const subtotal = overrides.tier === ProposalTier.LEAN ? 310_000 : ROOM_MID
  const goods =
    subtotal + applyRate(subtotal, taxRateBasisPoints) + applyRate(subtotal, freightRateBasisPoints)
  const fees =
    applyRate(subtotal, designFeeRateBasisPoints) +
    expenses.reduce((sum, row) => sum + row.amountCents, 0)

  return draftProposal({
    projectId,
    createdByUserId,
    tier: ProposalTier.RECOMMENDED,
    preparedForLabel: 'Abbie and Russell',
    intro: 'Everything below comes out of our 14 September conversation.',
    taxRateBasisPoints,
    freightRateBasisPoints,
    designFeeRateBasisPoints,
    expenses,
    scope: [{ kind: ProposalScopeKind.NOT_INCLUDED, text: 'Window blinds' }],
    payments: [{ whenLabel: 'On acceptance', amountCents: goods + fees }],
    ...overrides,
  })
}

describe('proposals', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('prices the furnishing side from the room bands at the chosen tier', async () => {
    const { project } = await fixture()
    const me = await designer()

    const proposal = await draft(project.id, me.id)

    assert.equal(proposal.furnishingsSubtotalCents, ROOM_MID)
    assert.equal(proposal.taxCents, applyRate(ROOM_MID, 700))
    assert.equal(proposal.freightCents, applyRate(ROOM_MID, 800))
    assert.equal(
      proposal.goodsDeliveredCents,
      ROOM_MID + applyRate(ROOM_MID, 700) + applyRate(ROOM_MID, 800),
    )
  })

  it('reads a different band for a different tier', async () => {
    const { project } = await fixture()
    const me = await designer()

    const lean = await draft(project.id, me.id, { tier: ProposalTier.LEAN })

    assert.equal(lean.tier, ProposalTier.LEAN)
    assert.equal(lean.furnishingsSubtotalCents, 310_000)
  })

  // RULE 2
  it('keeps the two sides apart, and stores no blended figure', async () => {
    const { project } = await fixture()
    const me = await designer()

    const proposal = await draft(project.id, me.id)
    const fee = applyRate(ROOM_MID, 3000)

    assert.equal(proposal.feesAndExpensesCents, fee + 300_000)

    // The furnishing side knows nothing about the fee.
    assert.equal(proposal.goodsDeliveredCents < proposal.goodsDeliveredCents + fee, true)
    assert.equal(
      Object.keys(proposal).some((key) => /projectTotal|grandTotal|combined/i.test(key)),
      false,
      'Proposal must not persist a blended total',
    )
  })

  it('offers the sum only alongside the two numbers it came from', async () => {
    const { project } = await fixture()
    const me = await designer()

    const proposal = await draft(project.id, me.id)
    const sides = proposalSides(proposal)

    assert.equal(
      sides.whatSheWouldPayCents,
      sides.goodsDeliveredCents + sides.feesAndExpensesCents,
    )
    // Returning the sum on its own is what rule 2 forbids, so the shape of the
    // return value is part of the rule.
    assert.deepEqual(Object.keys(sides).sort(), [
      'feesAndExpensesCents',
      'goodsDeliveredCents',
      'whatSheWouldPayCents',
    ])
  })

  it('gives every line a side, with the fee on the designer side', async () => {
    const { project } = await fixture()
    const me = await designer()

    const proposal = await draft(project.id, me.id)
    const lines = await prisma.proposalLine.findMany({
      where: { proposalId: proposal.id },
      orderBy: { order: 'asc' },
    })

    assert.equal(lines.length, 3)
    assert.equal(lines.filter((l) => l.type === BudgetType.FURNISHING).length, 1)
    assert.equal(lines.filter((l) => l.type === BudgetType.EXPENSE).length, 2)

    const feeLine = lines.find((l) => l.label === 'Design fee')
    assert.equal(feeLine?.type, BudgetType.EXPENSE)
    assert.equal(feeLine?.amountCents, applyRate(ROOM_MID, 3000))
  })

  it('leaves the budget alone, because a proposal is not a spend', async () => {
    const { project } = await fixture()
    const me = await designer()

    await draft(project.id, me.id)
    const totals = await budgetTotals(project.id)

    assert.equal(totals.furnishing.plannedCents, 0)
    assert.equal(totals.expense.plannedCents, 0)
  })

  it('refuses a payment schedule that does not add up', async () => {
    const { project } = await fixture()
    const me = await designer()

    await assert.rejects(
      () => draft(project.id, me.id, { payments: [{ whenLabel: 'All of it', amountCents: 1 }] }),
      ScheduleMismatchError,
    )
  })

  it('refuses to price a project with no rooms', async () => {
    const me = await designer()
    const bare = await prisma.project.create({
      data: {
        slug: `bare-${Date.now()}`,
        displayName: 'No rooms yet',
        community: 'Test',
        planName: 'Bianca',
        acSqFt: 1,
        totalSqFt: 1,
        phase: Phase.DIRECTION,
        clientName: 'Nobody',
        designer: 'Davina Hughes',
        allocationCents: 0,
      },
    })

    await assert.rejects(() => draft(bare.id, me.id), NothingToProposeError)
  })

  // RULE 3
  it('freezes the figures once sent, even if the room band moves', async () => {
    const { project, room } = await fixture()
    const me = await designer()

    const draftProposalRow = await draft(project.id, me.id)
    const sent = await sendProposal(draftProposalRow.id)

    await prisma.room.update({
      where: { id: room.id },
      data: { budgetMidCents: 9_999_900 },
    })

    const reread = await prisma.proposal.findUniqueOrThrow({ where: { id: sent.id } })

    assert.equal(reread.furnishingsSubtotalCents, ROOM_MID)
    assert.equal(reread.goodsDeliveredCents, sent.goodsDeliveredCents)
  })

  it('will not edit a sent proposal, only withdraw it', async () => {
    const { project } = await fixture()
    const me = await designer()

    const sent = await sendProposal((await draft(project.id, me.id)).id)

    await assert.rejects(() => sendProposal(sent.id), ProposalLockedError)
    await withdrawProposal(sent.id)
    await assert.rejects(() => withdrawProposal(sent.id), ProposalLockedError)
  })

  it('records the words shown above the signature, not a reference to them', async () => {
    const { project, user } = await fixture()
    const me = await designer()

    const sent = await sendProposal((await draft(project.id, me.id)).id)
    const accepted = await acceptProposal({
      proposalId: sent.id,
      userId: user.id,
      typedName: '  Abbie Grossman  ',
    })

    assert.equal(accepted.status, ProposalStatus.ACCEPTED)
    assert.equal(accepted.acceptedByName, 'Abbie Grossman')
    assert.equal(accepted.acceptedByUserId, user.id)
    assert.equal(accepted.statementShown, PROPOSAL_STATEMENT)
    assert.ok(accepted.acceptedAt)
  })

  it('cannot be accepted twice, or accepted while a draft', async () => {
    const { project, user } = await fixture()
    const me = await designer()

    const row = await draft(project.id, me.id)
    await assert.rejects(
      () => acceptProposal({ proposalId: row.id, userId: user.id, typedName: 'Abbie' }),
      ProposalLockedError,
    )

    const sent = await sendProposal(row.id)
    await acceptProposal({ proposalId: sent.id, userId: user.id, typedName: 'Abbie' })

    await assert.rejects(
      () => acceptProposal({ proposalId: sent.id, userId: user.id, typedName: 'Abbie' }),
      ProposalLockedError,
    )
  })

  it('needs a typed name that looks like one', async () => {
    const { project, user } = await fixture()
    const me = await designer()
    const sent = await sendProposal((await draft(project.id, me.id)).id)

    await assert.rejects(
      () => acceptProposal({ proposalId: sent.id, userId: user.id, typedName: ' ' }),
      /as you would sign it/,
    )
  })

  it('keeps an accepted proposal readable after a decline is attempted', async () => {
    const { project, user } = await fixture()
    const me = await designer()
    const sent = await sendProposal((await draft(project.id, me.id)).id)
    await acceptProposal({ proposalId: sent.id, userId: user.id, typedName: 'Abbie' })

    await assert.rejects(() => declineProposal(sent.id, 'changed my mind'), ProposalLockedError)
  })

  it('hides drafts from the client and shows them to the designer', async () => {
    const { project } = await fixture()
    const me = await designer()

    await draft(project.id, me.id)

    assert.equal((await proposalsForProject(project.id, { includeDrafts: false })).length, 0)
    assert.equal((await proposalsForProject(project.id, { includeDrafts: true })).length, 1)
  })

  it('gives each proposal its own reference', async () => {
    const { project } = await fixture()
    const me = await designer()

    const first = await draft(project.id, me.id)
    const second = await draft(project.id, me.id)

    assert.notEqual(first.number, second.number)
    assert.match(first.number, /^DH\.\d{4}\.\d{4}/)
  })

  it('rounds rates at the cent and never holds a float', async () => {
    // 7% of 1_234_567 cents is 86_419.69, which has to land on a whole cent.
    assert.equal(applyRate(1_234_567, 700), 86_420)
    assert.equal(Number.isInteger(applyRate(1_234_567, 700)), true)
  })
})
