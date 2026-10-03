import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { PaymentStage, ProposalScopeKind, ProposalTier, Role } from '@prisma/client'
import {
  chargeMetadata,
  PORTAL_SOURCE,
  settleInstalment,
  stageForPosition,
  statementDescriptorSuffix,
} from '../lib/payments'
import { applyRate, draftProposal } from '../lib/proposals'
import { fixture, prisma, reset } from './helpers'

/**
 * The Stripe account this portal charges through also carries a book and
 * course business with ninety-seven charges in it, none of them design work.
 * `source: "portal"` is the single field that separates the two forever, so
 * these tests are mostly about that field existing on everything.
 */

const ROOM_MID = 360_000

async function proposalWithSchedule(projectId: string, createdByUserId: string) {
  const goods = ROOM_MID + applyRate(ROOM_MID, 700) + applyRate(ROOM_MID, 800)
  const fees = applyRate(ROOM_MID, 3000)
  const owed = goods + fees
  const quarter = Math.floor(owed / 4)

  return draftProposal({
    projectId,
    createdByUserId,
    tier: ProposalTier.RECOMMENDED,
    preparedForLabel: 'Abbie and Russell',
    intro: 'Everything below comes out of our September conversation together.',
    taxRateBasisPoints: 700,
    freightRateBasisPoints: 800,
    designFeeRateBasisPoints: 3000,
    expenses: [],
    scope: [{ kind: ProposalScopeKind.NOT_INCLUDED, text: 'Window blinds' }],
    payments: [
      { whenLabel: 'On acceptance', amountCents: quarter },
      { whenLabel: 'January 2027', amountCents: quarter },
      { whenLabel: 'March 2027', amountCents: quarter },
      { whenLabel: 'At completion', amountCents: owed - quarter * 3 },
    ],
  })
}

describe('Stripe charge metadata', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('stamps source on every charge, which is the whole separation', () => {
    const meta = chargeMetadata({
      project: { id: 'proj_1', slug: '643-bianca' },
      proposal: { number: 'DH.2026.1003' },
      payment: { id: 'pay_1', stage: PaymentStage.DEPOSIT },
      clientSlug: 'abbie-tigges',
    })

    assert.equal(meta.source, PORTAL_SOURCE)
    assert.equal(meta.source, 'portal')
    assert.equal(meta.business, 'interiors')
  })

  it('carries every field reporting keys off, under the agreed names', () => {
    const meta = chargeMetadata({
      project: { id: 'proj_1', slug: '643-bianca' },
      proposal: { number: 'DH.2026.1003' },
      payment: { id: 'pay_1', stage: PaymentStage.GOODS_1 },
      clientSlug: 'abbie-tigges',
    })

    // Renaming any of these splits the Stripe history into before and after,
    // so the names are part of the contract rather than an implementation
    // detail. If this assertion fails, that is the point.
    assert.deepEqual(Object.keys(meta).sort(), [
      'business',
      'client',
      'invoice_ref',
      'payment_id',
      'project',
      'project_id',
      'source',
      'stage',
    ])

    assert.equal(meta.project, '643-bianca')
    assert.equal(meta.project_id, 'proj_1')
    assert.equal(meta.client, 'abbie-tigges')
    assert.equal(meta.invoice_ref, 'DH.2026.1003')
    assert.equal(meta.stage, 'goods-1')
  })

  it('renders each stage as the agreed string', () => {
    const stages: [PaymentStage, string][] = [
      [PaymentStage.DEPOSIT, 'deposit'],
      [PaymentStage.GOODS_1, 'goods-1'],
      [PaymentStage.GOODS_2, 'goods-2'],
      [PaymentStage.FINAL, 'final'],
    ]

    for (const [stage, expected] of stages) {
      const meta = chargeMetadata({
        project: { id: 'p', slug: 's' },
        proposal: { number: 'n' },
        payment: { id: 'i', stage },
        clientSlug: 'c',
      })
      assert.equal(meta.stage, expected)
    }
  })

  it('never emits an undefined value, which Stripe rejects', () => {
    const meta = chargeMetadata({
      project: { id: 'p', slug: '' },
      proposal: { number: '' },
      payment: { id: 'i', stage: PaymentStage.OTHER },
      clientSlug: '',
    })

    for (const [key, value] of Object.entries(meta)) {
      assert.equal(typeof value, 'string', `${key} must be a string`)
    }
  })

  it('stamps a stage on every instalment at draft time', async () => {
    const { project } = await fixture()
    const me = await prisma.user.create({
      data: { email: `d-${Date.now()}@example.invalid`, name: 'Davina', role: Role.DESIGNER },
    })

    const proposal = await proposalWithSchedule(project.id, me.id)
    const payments = await prisma.proposalPayment.findMany({
      where: { proposalId: proposal.id },
      orderBy: { order: 'asc' },
    })

    assert.equal(payments.length, 4)
    assert.deepEqual(
      payments.map((row) => row.stage),
      [PaymentStage.DEPOSIT, PaymentStage.GOODS_1, PaymentStage.GOODS_2, PaymentStage.FINAL],
    )
  })

  it('defaults a stage from position, including odd schedule lengths', () => {
    assert.equal(stageForPosition(0, 1), PaymentStage.DEPOSIT)
    assert.equal(stageForPosition(0, 4), PaymentStage.DEPOSIT)
    assert.equal(stageForPosition(3, 4), PaymentStage.FINAL)
    assert.equal(stageForPosition(1, 3), PaymentStage.GOODS_1)
    assert.equal(stageForPosition(4, 7), PaymentStage.OTHER)
  })

  it('keeps the statement descriptor inside what Stripe accepts', () => {
    assert.equal(statementDescriptorSuffix({ displayName: '643 Bianca' }), '643 Bianca')
    assert.equal(
      statementDescriptorSuffix({ displayName: 'A Very Long Project Name That Runs On' }).length <= 22,
      true,
    )
    assert.match(statementDescriptorSuffix({ displayName: "O'Brien & Co. — Plan #4" }), /^[A-Za-z0-9 ]*$/)
  })
})

describe('settling an instalment', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  async function instalment() {
    const { project } = await fixture()
    const me = await prisma.user.create({
      data: { email: `d-${Date.now()}@example.invalid`, name: 'Davina', role: Role.DESIGNER },
    })
    const proposal = await proposalWithSchedule(project.id, me.id)
    const row = await prisma.proposalPayment.findFirstOrThrow({
      where: { proposalId: proposal.id },
      orderBy: { order: 'asc' },
    })
    await prisma.proposalPayment.update({
      where: { id: row.id },
      data: { stripeSessionId: 'cs_test_session_1' },
    })
    return row
  }

  it('marks the matching instalment paid', async () => {
    const row = await instalment()

    const result = await settleInstalment({
      stripeSessionId: 'cs_test_session_1',
      paymentIntentId: 'pi_123',
      amountCents: row.amountCents,
    })

    assert.equal(result.settled, true)
    const after = await prisma.proposalPayment.findUniqueOrThrow({ where: { id: row.id } })
    assert.ok(after.paidAt)
    assert.equal(after.paidRef, 'pi_123')
    assert.equal(after.stripePaymentIntentId, 'pi_123')
  })

  it('is safe to replay, because Stripe retries deliveries', async () => {
    const row = await instalment()
    const first = await settleInstalment({
      stripeSessionId: 'cs_test_session_1',
      paymentIntentId: 'pi_123',
      amountCents: row.amountCents,
    })
    const paidAt = (await prisma.proposalPayment.findUniqueOrThrow({ where: { id: row.id } })).paidAt

    const second = await settleInstalment({
      stripeSessionId: 'cs_test_session_1',
      paymentIntentId: 'pi_123',
      amountCents: row.amountCents,
    })

    assert.equal(first.settled, true)
    assert.equal(second.settled, true)
    const again = await prisma.proposalPayment.findUniqueOrThrow({ where: { id: row.id } })
    assert.deepEqual(again.paidAt, paidAt, 'a replay must not move the paid timestamp')
  })

  it('refuses an amount that does not match the instalment', async () => {
    const row = await instalment()

    const result = await settleInstalment({
      stripeSessionId: 'cs_test_session_1',
      paymentIntentId: 'pi_123',
      amountCents: row.amountCents - 100,
    })

    assert.equal(result.settled, false)
    assert.match(result.reason ?? '', /does not match/)
    const after = await prisma.proposalPayment.findUniqueOrThrow({ where: { id: row.id } })
    assert.equal(after.paidAt, null)
  })

  it('ignores a session that belongs to no instalment', async () => {
    await instalment()

    const result = await settleInstalment({
      stripeSessionId: 'cs_someone_elses_book_sale',
      paymentIntentId: 'pi_999',
      amountCents: 700,
    })

    assert.equal(result.settled, false)
    assert.match(result.reason ?? '', /No instalment/)
  })
})
