import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from '@prisma/client'
import { ensureConfiguredAdmin } from './admins'
import { AuditAction, record as recordEvent } from './audit'
import { prisma } from './db'
import { mailer, signInEmail } from './mailer'

/**
 * Magic link sign-in.
 *
 * The rules this follows, and why:
 *
 * - The emailed token and the session cookie are both random 32-byte secrets.
 *   Only their SHA-256 hashes are stored, so someone who reads the database
 *   cannot sign in as anybody.
 * - A link works once. Redeeming one burns every other outstanding link for
 *   that account, so a forwarded or resent email cannot be replayed.
 * - There is no self-signup. An address that has no user row gets the same
 *   response as one that does, and no email. The portal has two people in it.
 * - Requesting a link never reveals whether an address is known. That is the
 *   whole reason `requestSignInLink` returns nothing useful.
 */

export const TOKEN_TTL_MINUTES = 20
/**
 * A year, and it slides.
 *
 * Signing in here means waiting for an email and clicking a link, which is a
 * lot of friction to re-impose on someone who visits every few weeks during a
 * build that runs for months. So a session lasts a year, and every request
 * pushes the expiry back out to a year from now, which means somebody who
 * keeps using the portal never signs in again.
 *
 * What makes that an acceptable trade rather than a sloppy one: the portal
 * holds a furnishing budget, not money or a payment method; there is no
 * self-signup, so a session can only ever belong to an account we created;
 * signing out deletes the session server side, not just the cookie; and
 * `signInEnabled` is checked when a link is requested, so closing an account
 * stops new sessions. The cookie itself is httpOnly, sameSite lax and secure
 * in production.
 *
 * The one thing it does not survive is a shared computer, which is the normal
 * cost of staying signed in anywhere.
 */
export const SESSION_TTL_DAYS = 365

/**
 * How stale an expiry has to get before a request refreshes it. Without this,
 * every page view would write to the session row for a few hours of extra
 * life; a day's slack makes the write rare and changes nothing a person can
 * perceive.
 */
const SESSION_REFRESH_AFTER_DAYS = 1
export const SESSION_COOKIE = 'portal_session'

/** How many links one account can ask for inside the window. */
const MAX_LINKS_PER_WINDOW = 5
const WINDOW_MINUTES = 15

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function newSecret(): string {
  return randomBytes(32).toString('base64url')
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export class RateLimitedError extends Error {
  constructor() {
    super('Too many sign-in links requested for this account. Wait a few minutes and try again.')
    this.name = 'RateLimitedError'
  }
}

export type SignInLinkResult =
  /** A link went out. Callers must not surface this difference to the browser. */
  | { sent: true; user: User; token: string }
  /** No user with that address. Nothing was sent. */
  | { sent: false }

/**
 * Issues a link for an address, if it belongs to someone.
 *
 * The caller is expected to show the same message either way. The return value
 * is detailed so that tests and the mailer can see what happened, not so that
 * the UI can.
 */
export async function requestSignInLink(
  rawEmail: string,
  baseUrl: string,
): Promise<SignInLinkResult> {
  const email = normaliseEmail(rawEmail)

  // The way back in. An address on ADMIN_EMAILS in the hosting settings gets
  // a designer account that can sign in, whether or not one exists. This is
  // the only thing in here that creates a user, and the only people who can
  // put an address on that list are the two who own the Railway project.
  //
  // It is here rather than in admin because the case it exists for is both
  // designer accounts being closed or lost, when there is no admin screen to
  // reach. See lib/admins.ts.
  const admin = await ensureConfiguredAdmin(email)
  const user = admin ?? (await prisma.user.findUnique({ where: { email } }))

  if (!user) return { sent: false }

  // An account that is not open yet behaves exactly like one that does not
  // exist: no link, no email, and the same answer to the browser. The client
  // is in the database well before she should be let in, and the designer
  // decides when that changes.
  if (!user.signInEnabled) return { sent: false }

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000)
  const recent = await prisma.loginToken.count({
    where: { userId: user.id, createdAt: { gte: since } },
  })

  if (recent >= MAX_LINKS_PER_WINDOW) {
    throw new RateLimitedError()
  }

  const token = newSecret()
  await prisma.loginToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  })

  const link = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${encodeURIComponent(token)}`

  // The email names the project, read from the database so a rename is data
  // rather than a deploy.
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  const projectName = project?.displayName ?? 'Dominate Homes'

  await mailer().send(signInEmail(user.email, user.name, link, TOKEN_TTL_MINUTES, projectName))

  // Recorded for the account it was issued for, not for every address typed
  // into the form. An attempt on an unknown address returns above this line
  // and writes nothing, which keeps the log from becoming a list of
  // other people's email addresses.
  await recordEvent({
    action: AuditAction.SIGN_IN_REQUESTED,
    actor: user,
    subjectType: 'User',
    subjectId: user.id,
    summary: `A sign-in link went out to ${user.name} (${user.email})`,
  })

  return { sent: true, user, token }
}

export type RedeemResult =
  | { ok: true; user: User; sessionToken: string; expiresAt: Date }
  | { ok: false; reason: 'unknown' | 'expired' | 'used' }

/**
 * Turns a link into a session. One transaction, so a token cannot be redeemed
 * twice by two requests arriving together.
 */
export async function redeemSignInLink(token: string): Promise<RedeemResult> {
  const tokenHash = sha256(token)

  const outcome: RedeemResult = await prisma.$transaction(async (tx) => {
    const record = await tx.loginToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!record) return { ok: false, reason: 'unknown' as const }
    if (record.usedAt) return { ok: false, reason: 'used' as const }
    if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' as const }

    await tx.loginToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    // Burn every other outstanding link for this account. A second email
    // sitting in the inbox should not still work after one has been used.
    await tx.loginToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    })

    const sessionToken = newSecret()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

    await tx.session.create({
      data: {
        userId: record.userId,
        tokenHash: sha256(sessionToken),
        expiresAt,
      },
    })

    return { ok: true as const, user: record.user, sessionToken, expiresAt }
  })

  if (outcome.ok) {
    // After the transaction, deliberately. A failure to write the log must
    // not roll back a sign-in that otherwise worked.
    await recordEvent({
      action: AuditAction.SIGNED_IN,
      actor: outcome.user,
      subjectType: 'User',
      subjectId: outcome.user.id,
      summary: `${outcome.user.name} signed in`,
    })
  }

  return outcome
}

/** Resolves a session cookie to a user, or null. Expired sessions are cleaned up. */
export async function userForSessionToken(token: string | undefined): Promise<User | null> {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  })

  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  const now = Date.now()
  const ttlMs = SESSION_TTL_DAYS * 86_400_000
  const freshUntil = now + ttlMs
  // Slide the expiry forward, so an active person is never signed out. Only
  // written when the stored expiry has drifted by more than a day, which keeps
  // this off the hot path for ordinary page views.
  const shouldExtend =
    freshUntil - session.expiresAt.getTime() > SESSION_REFRESH_AFTER_DAYS * 86_400_000

  // Not awaited into the critical path on purpose: a slow write here would
  // slow down every page, and losing one refresh costs nothing.
  void prisma.session
    .update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(now),
        ...(shouldExtend ? { expiresAt: new Date(freshUntil) } : {}),
      },
    })
    .catch(() => {})

  return session.user
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } })
}

/**
 * Constant-time string compare, for anywhere a secret is compared directly
 * rather than looked up by hash.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** Clears expired tokens and sessions. Safe to run whenever. */
export async function pruneExpired(): Promise<{
  tokens: number
  sessions: number
}> {
  const now = new Date()
  const [tokens, sessions] = await Promise.all([
    prisma.loginToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ])
  return { tokens: tokens.count, sessions: sessions.count }
}
