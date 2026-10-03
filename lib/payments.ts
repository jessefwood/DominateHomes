import {
  IntegrationKind,
  PaymentStage,
  type Project,
  type Proposal,
  type ProposalPayment,
} from '@prisma/client'
import { prisma } from './db'
import { secretFor } from './integrations'

/**
 * Taking a payment against an instalment on a proposal.
 *
 * Three rules shape this module, and all three came from outside it.
 *
 * ONE STRIPE ACCOUNT, TWO BUSINESSES. The Stripe account this portal charges
 * through is Jesse's, and its entire history is a book and course business:
 * ninety-seven charges, none of them design work. So every charge the portal
 * creates is stamped with `source: "portal"`, and that one field is what
 * separates design revenue from book revenue forever. A reporting query
 * filters on it by exact match. Without it the only thing telling an eleven
 * thousand dollar design deposit apart from a seven dollar ebook sale would be
 * that it is large, which is not a rule anybody should have to rely on.
 *
 * THE AMOUNT COMES FROM THE PROPOSAL. Never from a Stripe Product or Price.
 * Davina's rule is that she types every client-facing figure herself so she
 * knows it is right, and a product catalogue is a second place for a number to
 * live and therefore a place for it to drift. `amountCents` on the instalment
 * is the only source, and it was itself frozen when the proposal was sent.
 *
 * STAGE IS STAMPED FROM THE FIRST CHARGE. Retrofitting metadata means hand
 * tagging historical charges, so there is no version of this that writes an
 * untagged charge first and fixes it later.
 */

/** The discriminator. One field, exact match, design charges separable forever. */
export const PORTAL_SOURCE = 'portal'
export const PORTAL_BUSINESS = 'interiors'

const STAGE_TAG: Record<PaymentStage, string> = {
  [PaymentStage.DEPOSIT]: 'deposit',
  [PaymentStage.GOODS_1]: 'goods-1',
  [PaymentStage.GOODS_2]: 'goods-2',
  [PaymentStage.FINAL]: 'final',
  [PaymentStage.OTHER]: 'other',
}

/**
 * A default stage from the instalment's position in the schedule.
 *
 * The first is the deposit and the last is the final payment; anything between
 * is goods. It is only a default: the schedule is Davina's to write and a
 * four-row schedule is not a law.
 */
export function stageForPosition(index: number, total: number): PaymentStage {
  if (index === 0) return PaymentStage.DEPOSIT
  if (index === total - 1) return PaymentStage.FINAL
  if (index === 1) return PaymentStage.GOODS_1
  if (index === 2) return PaymentStage.GOODS_2
  return PaymentStage.OTHER
}

/** A metadata value Stripe will accept: 500 characters, and never undefined. */
function tag(value: string | null | undefined): string {
  return (value ?? '').slice(0, 500)
}

/**
 * The contract, in one place.
 *
 * Every charge the portal creates carries exactly this. Anything reading
 * Stripe for reporting keys off these names, so they are not to be renamed
 * casually: a rename splits the history into before and after.
 */
export function chargeMetadata(input: {
  project: Pick<Project, 'id' | 'slug'>
  proposal: Pick<Proposal, 'number'>
  payment: Pick<ProposalPayment, 'id' | 'stage'>
  clientSlug: string
}): Record<string, string> {
  return {
    source: PORTAL_SOURCE,
    business: PORTAL_BUSINESS,
    project_id: tag(input.project.id),
    project: tag(input.project.slug),
    client: tag(input.clientSlug),
    invoice_ref: tag(input.proposal.number),
    stage: STAGE_TAG[input.payment.stage],
    payment_id: tag(input.payment.id),
  }
}

/**
 * What the client sees on their card statement.
 *
 * The account's own descriptor is set for the book business, so a design
 * client paying five figures would see something they do not recognise, which
 * is how a chargeback starts. Stripe allows a per-payment suffix; 22
 * characters is the limit and only letters, numbers and spaces are safe.
 */
export function statementDescriptorSuffix(project: Pick<Project, 'displayName'>): string {
  return project.displayName
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 22)
}

export class StripeNotConnectedError extends Error {
  constructor() {
    super('Stripe is not connected, so this instalment cannot be paid online yet.')
    this.name = 'StripeNotConnectedError'
  }
}

export class AlreadyPaidError extends Error {
  constructor() {
    super('That instalment is already settled.')
    this.name = 'AlreadyPaidError'
  }
}

/** Stripe wants form encoding, including for nested keys like metadata[source]. */
function formEncode(params: Record<string, string | number | undefined>): string {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    body.set(key, String(value))
  }
  return body.toString()
}

/**
 * Opens a Checkout Session for one instalment and returns the URL to send the
 * client to.
 *
 * The session id is written back onto the row before the client is sent
 * anywhere, so a payment that completes can always be matched to the
 * instalment it settled without comparing amounts.
 */
export async function startInstalmentCheckout(input: {
  paymentId: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string }> {
  const secret = await secretFor(IntegrationKind.STRIPE)
  if (!secret) throw new StripeNotConnectedError()

  const payment = await prisma.proposalPayment.findUniqueOrThrow({
    where: { id: input.paymentId },
    include: { proposal: { include: { project: true } } },
  })

  if (payment.paidAt) throw new AlreadyPaidError()

  const project = payment.proposal.project
  const client = await prisma.projectMember.findFirst({
    where: { projectId: project.id, user: { role: 'CLIENT' } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const clientSlug = (client?.user.name ?? project.clientName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const metadata = chargeMetadata({
    project,
    proposal: payment.proposal,
    payment,
    clientSlug,
  })

  const params: Record<string, string | number | undefined> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: client?.user.email,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'usd',
    // The amount is the frozen figure off the proposal. No Stripe Price, no
    // product catalogue, nothing that could drift from what Davina entered.
    'line_items[0][price_data][unit_amount]': payment.amountCents,
    'line_items[0][price_data][product_data][name]':
      `${project.displayName} · ${payment.whenLabel}`,
    'line_items[0][price_data][product_data][description]': tag(
      payment.detail ?? `Proposal ${payment.proposal.number}`,
    ),
    'payment_intent_data[statement_descriptor_suffix]': statementDescriptorSuffix(project),
  }

  // Stamped in both places: on the session for the Checkout record, and on the
  // PaymentIntent, because that is what a charge-level report reads.
  for (const [key, value] of Object.entries(metadata)) {
    params[`metadata[${key}]`] = value
    params[`payment_intent_data[metadata][${key}]`] = value
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Makes a retried click reuse the same session rather than opening a
      // second one against the same instalment.
      'Idempotency-Key': `instalment-${payment.id}`,
    },
    body: formEncode(params),
  })

  const json = (await response.json()) as {
    id?: string
    url?: string
    error?: { message?: string }
  }

  if (!response.ok || !json.url || !json.id) {
    throw new Error(json.error?.message ?? `Stripe refused the request (${response.status}).`)
  }

  await prisma.proposalPayment.update({
    where: { id: payment.id },
    data: { stripeSessionId: json.id },
  })

  return { url: json.url }
}

/**
 * Marks an instalment settled.
 *
 * Only ever called from the webhook, never from the browser returning to the
 * success URL: a success URL is a page load the client controls and can be
 * visited without paying. The Stripe reference is what makes this safe to
 * replay, because the row is matched by session id rather than by amount.
 */
export async function settleInstalment(input: {
  stripeSessionId: string
  paymentIntentId: string | null
  amountCents: number
}): Promise<{ settled: boolean; reason?: string }> {
  const payment = await prisma.proposalPayment.findUnique({
    where: { stripeSessionId: input.stripeSessionId },
  })

  if (!payment) return { settled: false, reason: 'No instalment matches that session.' }
  if (payment.paidAt) return { settled: true }

  // A mismatch here means the session was not the one we opened for this row.
  // Refusing is right: silently accepting would record a payment that did not
  // happen at the amount claimed.
  if (payment.amountCents !== input.amountCents) {
    return {
      settled: false,
      reason: `Amount does not match: expected ${payment.amountCents}, Stripe reported ${input.amountCents}.`,
    }
  }

  await prisma.proposalPayment.update({
    where: { id: payment.id },
    data: {
      paidAt: new Date(),
      paidRef: input.paymentIntentId ?? input.stripeSessionId,
      stripePaymentIntentId: input.paymentIntentId,
    },
  })

  return { settled: true }
}
