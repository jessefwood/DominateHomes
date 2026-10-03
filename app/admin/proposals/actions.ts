'use server'

import { revalidatePath } from 'next/cache'
import { ProposalScopeKind, ProposalTier } from '@prisma/client'
import { prisma } from '@/lib/db'
import { dollars } from '@/lib/money'
import {
  applyRate,
  draftProposal,
  sendProposal,
  withdrawProposal,
  type ExpenseInput,
  type PaymentInput,
} from '@/lib/proposals'
import { requireDesigner } from '@/lib/session'

/**
 * Drafting a proposal from the admin side.
 *
 * The furnishing side is read from the project's own rooms, so there is no
 * form field for it and no way for the document to disagree with the budget on
 * the day it is drafted. What the form does ask for is the handful of things
 * that are genuinely Davina's to set: the tier, the three rates, and her
 * expenses. Those are not derivable and guessing them would be worse than
 * asking.
 */

function money(form: FormData, key: string): number {
  const raw = String(form.get(key) ?? '').replace(/[$,\s]/g, '')
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return 0
  return dollars(value)
}

function rate(form: FormData, key: string, fallback: number): number {
  const raw = String(form.get(key) ?? '').replace(/[%\s]/g, '')
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return fallback
  return Math.round(value * 100)
}

export async function createProposalDraft(form: FormData): Promise<{ error?: string; id?: string }> {
  const me = await requireDesigner()

  const projectId = String(form.get('projectId') ?? '')
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return { error: 'Pick a project.' }

  const tier = String(form.get('tier') ?? '') as ProposalTier
  if (!Object.values(ProposalTier).includes(tier)) return { error: 'Pick a level.' }

  const preparedForLabel = String(form.get('preparedForLabel') ?? '').trim()
  if (!preparedForLabel) return { error: 'Say who this is addressed to, e.g. "Abbie and Russell".' }

  const intro = String(form.get('intro') ?? '').trim()
  if (intro.length < 20) return { error: 'Write the opening paragraph. It is the part she reads first.' }

  const taxRateBasisPoints = rate(form, 'taxRate', 700)
  const freightRateBasisPoints = rate(form, 'freightRate', 800)
  const designFeeRateBasisPoints = rate(form, 'designFeeRate', 3000)

  // Expenses arrive as parallel label/amount fields. A blank label drops the row.
  const expenses: ExpenseInput[] = []
  for (let index = 0; index < 8; index += 1) {
    const label = String(form.get(`expenseLabel${index}`) ?? '').trim()
    if (!label) continue
    expenses.push({
      label,
      detail: String(form.get(`expenseDetail${index}`) ?? '').trim() || undefined,
      amountCents: money(form, `expenseAmount${index}`),
    })
  }

  const scope = (['INCLUDED', 'NOT_INCLUDED', 'CLIENT_OWNED'] as const).flatMap((kind) =>
    String(form.get(`scope${kind}`) ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ kind: ProposalScopeKind[kind], text })),
  )

  // The schedule has to add up to the two sides, and draftProposal refuses it
  // if it does not. Rather than make Davina do the arithmetic, an empty
  // schedule gets the one instalment that is always correct.
  const payments: PaymentInput[] = []
  for (let index = 0; index < 6; index += 1) {
    const whenLabel = String(form.get(`paymentWhen${index}`) ?? '').trim()
    if (!whenLabel) continue
    payments.push({
      whenLabel,
      detail: String(form.get(`paymentDetail${index}`) ?? '').trim() || undefined,
      amountCents: money(form, `paymentAmount${index}`),
    })
  }

  if (payments.length === 0) {
    const rooms = await prisma.room.findMany({ where: { projectId }, orderBy: { order: 'asc' } })
    const field =
      tier === ProposalTier.LEAN
        ? 'budgetLowCents'
        : tier === ProposalTier.ELEVATED
          ? 'budgetHighCents'
          : 'budgetMidCents'
    const subtotal = rooms.reduce((sum, room) => sum + room[field], 0)
    const goods =
      subtotal + applyRate(subtotal, taxRateBasisPoints) + applyRate(subtotal, freightRateBasisPoints)
    const fees =
      applyRate(subtotal, designFeeRateBasisPoints) +
      expenses.reduce((sum, row) => sum + row.amountCents, 0)

    payments.push({
      whenLabel: 'On acceptance',
      detail: 'Set a real schedule before sending this.',
      amountCents: goods + fees,
    })
  }

  try {
    const proposal = await draftProposal({
      projectId,
      createdByUserId: me.id,
      tier,
      preparedForLabel,
      intro,
      taxRateBasisPoints,
      freightRateBasisPoints,
      designFeeRateBasisPoints,
      expenses,
      scope,
      payments,
    })

    revalidatePath('/admin/proposals')
    return { id: proposal.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not go through.' }
  }
}

export async function issueProposal(proposalId: string): Promise<{ error?: string; ok?: true }> {
  await requireDesigner()

  try {
    const proposal = await sendProposal(proposalId)
    revalidatePath('/admin/proposals')
    const project = await prisma.project.findUnique({ where: { id: proposal.projectId } })
    if (project) revalidatePath(`/portal/${project.slug}/proposal`)
    return { ok: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not go through.' }
  }
}

export async function pullProposal(proposalId: string): Promise<{ error?: string; ok?: true }> {
  await requireDesigner()

  try {
    await withdrawProposal(proposalId)
    revalidatePath('/admin/proposals')
    return { ok: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not go through.' }
  }
}
