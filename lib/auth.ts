import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from '@prisma/client'
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
export const SESSION_TTL_DAYS = 30
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
export async function requestSignInLink(rawEmail: string, baseUrl: string): Promise<SignInLinkResult> {
  const email = normaliseEmail(rawEmail)
  const user = await prisma.user.findUnique({ where: { email } })

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
  const project = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
  const projectName = project?.displayName ?? 'Dominate Homes'

  await mailer().send(signInEmail(user.email, user.name, link, TOKEN_TTL_MINUTES, projectName))

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

  return prisma.$transaction(async (tx) => {
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
      data: { userId: record.userId, tokenHash: sha256(sessionToken), expiresAt },
    })

    return { ok: true as const, user: record.user, sessionToken, expiresAt }
  })
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

  // Cheap last-seen tracking. Not awaited into the critical path on purpose.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
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
export async function pruneExpired(): Promise<{ tokens: number; sessions: number }> {
  const now = new Date()
  const [tokens, sessions] = await Promise.all([
    prisma.loginToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ])
  return { tokens: tokens.count, sessions: sessions.count }
}
