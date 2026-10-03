import {
  BudgetType,
  type PaymentStage,
  ProposalScopeKind,
  ProposalStatus,
  ProposalTier,
  type Proposal,
  type ProposalLine,
  type ProposalPayment,
} from '@prisma/client'
import { prisma } from './db'
import { stageForPosition } from './payments'
import { PROPOSAL_STATEMENT } from './proposal-statement'

export { PROPOSAL_STATEMENT }

/**
 * Proposals: the priced document the client says yes to.
 *
 * RULE 3 LIVES HERE TOO. A proposal snapshots every figure at the moment it is
 * sent. Nothing below reads a price back through a relation to render a sent
 * proposal, so re-pricing an option or editing a budget line next month cannot
 * change what she agreed to. Once a proposal leaves DRAFT it is frozen: there
 * is no function in this module that edits a sent one. To change a sent
 * proposal you withdraw it and issue a new one, and the old record stands.
 *
 * RULE 2 LIVES HERE IN A FORM WORTH READING CAREFULLY.
 *
 * The rule is that the furnishing spend and the designer's expenses are two
 * totals that never blend, and lib/budget.ts holds that line absolutely: it
 * has no function returning a combined number and `BudgetTotals` has no
 * `total` field. That is right for the budget, where a single blended figure
 * would hide an overspend on one side behind room on the other.
 *
 * A proposal is a different artifact. Nobody can say yes to a number they
 * have not been shown, and the invoice this project already sends does show
 * one: "goods delivered plus design fee and expenses". So this module does
 * provide that sum, in `proposalSides`, under a name that says exactly what it
 * is, and it is computed for display only. It is not stored: `Proposal` has no
 * `projectTotalCents` column, the two sides are persisted separately, and
 * lib/budget.ts is untouched. The database still cannot hold a blended figure,
 * and no screen can show the sum without also showing the two numbers it came
 * from, because `proposalSides` returns all three together.
 */

export class ProposalLockedError extends Error {
  constructor(status: ProposalStatus) {
    super(
      `This proposal is ${status.toLowerCase()} and cannot be edited. ` +
        'Withdraw it and issue a new one: the record of what was sent has to stand.',
    )
    this.name = 'ProposalLockedError'
  }
}

export class NothingToProposeError extends Error {
  constructor() {
    super('This project has no rooms with a planning band, so there is nothing to price yet.')
    this.name = 'NothingToProposeError'
  }
}

/** Which room band each tier reads. Lean, recommended and elevated, in order. */
const TIER_FIELD: Record<ProposalTier, 'budgetLowCents' | 'budgetMidCents' | 'budgetHighCents'> = {
  [ProposalTier.LEAN]: 'budgetLowCents',
  [ProposalTier.RECOMMENDED]: 'budgetMidCents',
  [ProposalTier.ELEVATED]: 'budgetHighCents',
}

export const TIER_LABEL: Record<ProposalTier, string> = {
  [ProposalTier.LEAN]: 'Lean',
  [ProposalTier.RECOMMENDED]: 'Recommended',
  [ProposalTier.ELEVATED]: 'Elevated',
}

/** Rates are basis points so nothing here is ever a float. 7% is 700. */
export function applyRate(amountCents: number, basisPoints: number): number {
  return Math.round((amountCents * basisPoints) / 10_000)
}

export type ProposalSides = {
  /** Furnishing side: subtotal plus tax plus freight. */
  goodsDeliveredCents: number
  /** Designer's side: the fee and every expense. */
  feesAndExpensesCents: number
  /**
   * The two above, added, for the one place a client needs it: deciding
   * whether to accept. Display only, never stored, and never returned without
   * the two figures it came from. See the rule 2 note at the top of this file.
   */
  whatSheWouldPayCents: number
}

export function proposalSides(proposal: {
  goodsDeliveredCents: number
  feesAndExpensesCents: number
}): ProposalSides {
  return {
    goodsDeliveredCents: proposal.goodsDeliveredCents,
    feesAndExpensesCents: proposal.feesAndExpensesCents,
    whatSheWouldPayCents: proposal.goodsDeliveredCents + proposal.feesAndExpensesCents,
  }
}

/** A designer-side line the proposal has to be told about: it is not derivable. */
export type ExpenseInput = {
  label: string
  detail?: string
  amountCents: number
}

export type ScopeInput = {
  kind: ProposalScopeKind
  text: string
}

export type PaymentInput = {
  whenLabel: string
  detail?: string
  amountCents: number
  /**
   * Which instalment this is, for the Stripe charge metadata. Defaults from
   * position in the schedule: first is the deposit, last is the final payment,
   * the ones between are goods. Pass it explicitly where a schedule does not
   * follow that shape.
   */
  stage?: PaymentStage
}

export type DraftProposalInput = {
  projectId: string
  createdByUserId: string
  tier: ProposalTier
  /** "Abbie and Russell". How the document addresses her. */
  preparedForLabel: string
  /** The opening paragraph, in Davina's words. */
  intro: string
  /** 700 for 7%. State 6% plus the county surtax, so this is checked per project. */
  taxRateBasisPoints: number
  /** 800 for 8%. An allowance on goods, not a quote. */
  freightRateBasisPoints: number
  /** 3000 for 30% of the furnishings subtotal. */
  designFeeRateBasisPoints: number
  /** Everything on the designer's side other than the fee itself. */
  expenses: ExpenseInput[]
  /** In, out, and what she already owns. */
  scope: ScopeInput[]
  /**
   * The instalments. Left to the caller rather than derived, because a
   * schedule is a negotiation: it has to add up to the two sides, and
   * `draftProposal` checks that it does rather than quietly fixing it.
   */
  payments: PaymentInput[]
  validUntilOn?: Date
}

/**
 * The reference on the paper, e.g. DH.2026.1003.
 *
 * Collision is possible in principle, since two proposals could be drafted on
 * one day. `number` is unique at the database, so the second write fails
 * loudly rather than overwriting the first, and the suffix below keeps that
 * from happening in practice.
 */
export async function nextProposalNumber(on = new Date()): Promise<string> {
  const year = on.getUTCFullYear()
  const stamp = `${String(on.getUTCMonth() + 1).padStart(2, '0')}${String(on.getUTCDate()).padStart(2, '0')}`
  const prefix = `DH.${year}.${stamp}`

  const taken = await prisma.proposal.count({ where: { number: { startsWith: prefix } } })

  return taken === 0 ? prefix : `${prefix}-${taken + 1}`
}

export class ScheduleMismatchError extends Error {
  constructor(scheduleCents: number, owedCents: number) {
    super(
      `The payment schedule adds up to ${scheduleCents} cents but the proposal comes to ` +
        `${owedCents} cents. A schedule that does not add up is the kind of thing a client ` +
        'spots, so fix the instalments before sending.',
    )
    this.name = 'ScheduleMismatchError'
  }
}

/**
 * Builds a draft from the project's own room bands.
 *
 * The furnishing side is read from the rooms at the chosen tier, so the
 * document and the budget cannot disagree on the day it is drafted. The
 * designer's side is passed in: a fee percentage and a crew day rate are
 * Davina's to set and not something to guess from data.
 *
 * Everything is written in one transaction, so a proposal is never half
 * drafted, and the figures are stored as literals from this point on.
 */
export async function draftProposal(input: DraftProposalInput): Promise<Proposal> {
  const rooms = await prisma.room.findMany({
    where: { projectId: input.projectId },
    orderBy: { order: 'asc' },
  })

  if (rooms.length === 0) throw new NothingToProposeError()

  const field = TIER_FIELD[input.tier]

  const roomLines = rooms
    .map((room) => ({ label: room.name, detail: room.contents, amountCents: room[field] }))
    .filter((line) => line.amountCents > 0)

  if (roomLines.length === 0) throw new NothingToProposeError()

  const furnishingsSubtotalCents = roomLines.reduce((sum, line) => sum + line.amountCents, 0)
  const taxCents = applyRate(furnishingsSubtotalCents, input.taxRateBasisPoints)
  const freightCents = applyRate(furnishingsSubtotalCents, input.freightRateBasisPoints)
  const goodsDeliveredCents = furnishingsSubtotalCents + taxCents + freightCents

  const designFeeCents = applyRate(furnishingsSubtotalCents, input.designFeeRateBasisPoints)
  const expenseLines: ExpenseInput[] = [
    {
      label: 'Design fee',
      detail:
        'Space planning, sourcing and specification, procurement management, and the selection rounds. ' +
        `${(input.designFeeRateBasisPoints / 100).toFixed(0)}% of the furnishings subtotal.`,
      amountCents: designFeeCents,
    },
    ...input.expenses,
  ]

  const feesAndExpensesCents = expenseLines.reduce((sum, line) => sum + line.amountCents, 0)

  const scheduleCents = input.payments.reduce((sum, row) => sum + row.amountCents, 0)
  const owedCents = goodsDeliveredCents + feesAndExpensesCents

  if (scheduleCents !== owedCents) throw new ScheduleMismatchError(scheduleCents, owedCents)

  const number = await nextProposalNumber()

  return prisma.proposal.create({
    data: {
      projectId: input.projectId,
      createdByUserId: input.createdByUserId,
      number,
      tier: input.tier,
      status: ProposalStatus.DRAFT,
      preparedForLabel: input.preparedForLabel,
      intro: input.intro,
      furnishingsSubtotalCents,
      taxRateBasisPoints: input.taxRateBasisPoints,
      taxCents,
      freightRateBasisPoints: input.freightRateBasisPoints,
      freightCents,
      goodsDeliveredCents,
      designFeeRateBasisPoints: input.designFeeRateBasisPoints,
      feesAndExpensesCents,
      validUntilOn: input.validUntilOn ?? null,
      lines: {
        create: [
          ...roomLines.map((line, index) => ({
            type: BudgetType.FURNISHING,
            label: line.label,
            detail: line.detail,
            amountCents: line.amountCents,
            order: index,
          })),
          ...expenseLines.map((line, index) => ({
            type: BudgetType.EXPENSE,
            label: line.label,
            detail: line.detail ?? null,
            amountCents: line.amountCents,
            order: roomLines.length + index,
          })),
        ],
      },
      payments: {
        create: input.payments.map((row, index) => ({
          whenLabel: row.whenLabel,
          detail: row.detail ?? null,
          amountCents: row.amountCents,
          order: index,
          // Required with no default, deliberately: a charge that reaches
          // Stripe without a stage cannot be reconciled afterwards except by
          // comparing amounts, and retrofitting means hand tagging history.
          stage: row.stage ?? stageForPosition(index, input.payments.length),
        })),
      },
      scope: {
        create: input.scope.map((row, index) => ({
          kind: row.kind,
          text: row.text,
          order: index,
        })),
      },
    },
  })
}

/** Issues a draft. After this the figures are what she was shown, for good. */
export async function sendProposal(proposalId: string): Promise<Proposal> {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({ where: { id: proposalId } })

    if (proposal.status !== ProposalStatus.DRAFT) throw new ProposalLockedError(proposal.status)

    const now = new Date()

    return tx.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.SENT, sentAt: now, issuedOn: now },
    })
  })
}

/**
 * Accepts a sent proposal.
 *
 * The statement is copied onto the record, like an approval, so the file shows
 * the words she was shown rather than whatever the template says later. The
 * typed name is kept beside the user id because the id proves who was signed
 * in and the typed name is what she actually wrote.
 */
export async function acceptProposal(input: {
  proposalId: string
  userId: string
  typedName: string
}): Promise<Proposal> {
  const typedName = input.typedName.trim()

  if (typedName.length < 2) {
    throw new Error('Type your name as you would sign it.')
  }

  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({ where: { id: input.proposalId } })

    if (proposal.status !== ProposalStatus.SENT) throw new ProposalLockedError(proposal.status)

    return tx.proposal.update({
      where: { id: input.proposalId },
      data: {
        status: ProposalStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
        acceptedByName: typedName,
        statementShown: PROPOSAL_STATEMENT,
      },
    })
  })
}

export async function declineProposal(proposalId: string, note: string): Promise<Proposal> {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({ where: { id: proposalId } })

    if (proposal.status !== ProposalStatus.SENT) throw new ProposalLockedError(proposal.status)

    return tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.DECLINED,
        declinedAt: new Date(),
        declineNote: note.trim() || null,
      },
    })
  })
}

/** Pulls a proposal back. Allowed from draft or sent, never after acceptance. */
export async function withdrawProposal(proposalId: string): Promise<Proposal> {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUniqueOrThrow({ where: { id: proposalId } })

    if (proposal.status === ProposalStatus.ACCEPTED || proposal.status === ProposalStatus.WITHDRAWN) {
      throw new ProposalLockedError(proposal.status)
    }

    return tx.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.WITHDRAWN },
    })
  })
}

export type FullProposal = Proposal & {
  lines: ProposalLine[]
  payments: ProposalPayment[]
  scope: { id: string; kind: ProposalScopeKind; text: string; order: number }[]
}

/** The whole document, in document order. */
export async function proposalFor(proposalId: string): Promise<FullProposal | null> {
  return prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lines: { orderBy: { order: 'asc' } },
      payments: { orderBy: { order: 'asc' } },
      scope: { orderBy: { order: 'asc' } },
    },
  })
}

/**
 * What the client is allowed to see: anything issued, and nothing in draft.
 *
 * A draft is a working document with placeholder fees in it. Showing one to
 * the client would be worse than showing nothing.
 */
export const CLIENT_VISIBLE_STATUSES = [
  ProposalStatus.SENT,
  ProposalStatus.ACCEPTED,
  ProposalStatus.DECLINED,
] as const

export async function proposalsForProject(
  projectId: string,
  opts: { includeDrafts: boolean },
): Promise<FullProposal[]> {
  return prisma.proposal.findMany({
    where: {
      projectId,
      ...(opts.includeDrafts ? {} : { status: { in: [...CLIENT_VISIBLE_STATUSES] } }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      lines: { orderBy: { order: 'asc' } },
      payments: { orderBy: { order: 'asc' } },
      scope: { orderBy: { order: 'asc' } },
    },
  })
}

/** The one the client should be looking at: accepted if there is one, else the latest sent. */
export async function currentProposalFor(projectId: string): Promise<FullProposal | null> {
  const accepted = await proposalsForProject(projectId, { includeDrafts: false })
  return (
    accepted.find((p) => p.status === ProposalStatus.ACCEPTED) ??
    accepted.find((p) => p.status === ProposalStatus.SENT) ??
    null
  )
}
