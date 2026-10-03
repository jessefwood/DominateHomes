import { createHmac, timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { settleInstalment } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * Where Stripe tells us a payment actually happened.
 *
 * This exists rather than marking the instalment paid when the browser lands
 * on the success URL, because a success URL is a page the client can open
 * without paying. Stripe signs this request and nobody else can, which is the
 * only trustworthy signal that money moved.
 *
 * Set STRIPE_WEBHOOK_SECRET in Railway to the signing secret Stripe shows when
 * the endpoint is created. Without it every delivery is refused: a webhook
 * that accepts unsigned requests is a public endpoint for marking invoices
 * paid, which is worse than having no webhook at all.
 */

const TOLERANCE_SECONDS = 300

/**
 * Stripe's scheme: the header carries a timestamp and one or more v1
 * signatures, each an HMAC-SHA256 of `${timestamp}.${rawBody}`.
 *
 * The raw body matters. Parsing and re-serialising the JSON would change the
 * bytes and every signature would fail, which is why this reads text() and
 * parses only after the check passes.
 */
function signatureValid(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false

  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [key, ...rest] = piece.trim().split('=')
      return [key, rest.join('=')]
    }),
  )

  const timestamp = Number(parts.t)
  if (!Number.isFinite(timestamp)) return false

  // Stops a captured delivery being replayed later.
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const candidates = header
    .split(',')
    .map((piece) => piece.trim())
    .filter((piece) => piece.startsWith('v1='))
    .map((piece) => piece.slice(3))

  return candidates.some((candidate) => {
    const a = Buffer.from(candidate, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

type CheckoutSession = {
  id?: string
  payment_intent?: string | null
  amount_total?: number | null
  payment_status?: string
  metadata?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set. Refused.')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 })
  }

  const rawBody = await request.text()

  if (!signatureValid(rawBody, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 400 })
  }

  let event: { type?: string; data?: { object?: CheckoutSession } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Body was not JSON.' }, { status: 400 })
  }

  // Only one event type matters today. Everything else is acknowledged rather
  // than refused, so Stripe does not retry deliveries we simply do not use.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const session = event.data?.object

  if (!session?.id || session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, ignored: 'not paid' })
  }

  // Charges from elsewhere in this Stripe account are not ours to act on. The
  // account also carries a book and course business, and this endpoint must
  // not touch its payments.
  if (session.metadata?.source !== 'portal') {
    return NextResponse.json({ received: true, ignored: 'not a portal charge' })
  }

  const result = await settleInstalment({
    stripeSessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amountCents: session.amount_total ?? -1,
  })

  if (!result.settled) {
    // Logged loudly and acknowledged: retrying will not fix a mismatch, and a
    // 500 here would have Stripe redeliver this for days.
    console.error('Stripe webhook could not settle an instalment', {
      session: session.id,
      reason: result.reason,
    })
    return NextResponse.json({ received: true, settled: false, reason: result.reason })
  }

  return NextResponse.json({ received: true, settled: true })
}
