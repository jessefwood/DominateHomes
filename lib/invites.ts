import { createHash, randomBytes } from 'node:crypto'
import { Role, type Invite, type User } from '@prisma/client'
import { AuditAction, record } from './audit'
import { normaliseEmail, SESSION_TTL_DAYS } from './auth'
import { prisma } from './db'
import { inviteEmail, mailer } from './mailer'

/**
 * Inviting a client.
 *
 * Still no self-signup. This and an approved access request are the only two
 * ways a user row comes into being, and both of them end with a designer
 * deciding. Nothing here can hand out the designer role: `accept` writes
 * `Role.CLIENT` as a literal, and there is no argument that changes it.
 *
 * Same shape as LoginToken, for the same reasons: the emailed secret is never
 * stored, only its SHA-256 hash, so a leak of the Invite table cannot be used
 * to get in.
 */

/**
 * A week.
 *
 * An invitation has to survive a weekend and a holiday, which a 20 minute
 * sign-in link does not have to. What stops that being a week-long key to the
 * portal is that accepting it burns it: see `accept`.
 */
export const INVITE_TTL_DAYS = 7

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export class InviteError extends Error {}

export function inviteLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/auth/invite?token=${encodeURIComponent(token)}`
}

export type SendInviteInput = {
  email: string
  name: string
  projectId?: string | null
  /** How they want to be described on the project, e.g. "Abbie and Russell". */
  label?: string | null
}

/**
 * Writes the invitation and emails it.
 *
 * Refuses an address that already has an account, because the thing the
 * person meant in that case is almost always "add them to this project", and
 * a second account on a second row is how one person ends up with two
 * histories.
 */
export async function sendInvite(
  actor: User,
  baseUrl: string,
  input: SendInviteInput,
): Promise<Invite> {
  const email = normaliseEmail(input.email)
  const name = input.name.trim()

  if (!email.includes('@') || email.length > 320) throw new InviteError('That does not look like an email address.')
  if (!name) throw new InviteError('Put in a name, so the email can say hello properly.')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new InviteError(
      `${existing.name} already has an account on that address. Add them to the project instead of inviting them again.`,
    )
  }

  const project = input.projectId
    ? await prisma.project.findUnique({ where: { id: input.projectId } })
    : null

  if (input.projectId && !project) throw new InviteError('No such project.')

  // An outstanding invitation for the same address is replaced rather than
  // duplicated. Two live links to one inbox is a confusing thing to debug
  // later, and the person asking for this almost always means "send it again".
  await prisma.invite.updateMany({
    where: { email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const token = randomBytes(32).toString('base64url')

  const invite = await prisma.invite.create({
    data: {
      email,
      name,
      projectId: project?.id ?? null,
      label: input.label?.trim() || null,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      createdById: actor.id,
    },
  })

  await mailer().send(
    inviteEmail(
      email,
      name,
      inviteLink(baseUrl, token),
      INVITE_TTL_DAYS,
      project?.displayName ?? 'Dominate Homes',
      actor.name,
    ),
  )

  await record({
    action: AuditAction.INVITE_SENT,
    actor,
    projectId: project?.id ?? null,
    subjectType: 'Invite',
    subjectId: invite.id,
    summary: `${actor.name} invited ${name} (${email})${project ? ` to ${project.displayName}` : ''}`,
  })

  return invite
}

export type AcceptResult =
  | { ok: true; user: User; sessionToken: string; expiresAt: Date; projectSlug: string | null }
  /**
   * `spent` is an invitation that has already been accepted. It is worth its
   * own answer rather than being lumped in with the failures, because the
   * right thing to tell that person is "your account is set up, sign in" and
   * not "that link did not work".
   */
  | { ok: false; reason: 'unknown' | 'expired' | 'revoked' | 'spent' }

/**
 * Turns an invitation into an account, a membership and a session.
 *
 * One transaction, so two clicks arriving together cannot make two accounts.
 *
 * Accepting burns the invitation. A second use does not sign anybody in: it
 * answers `spent`, and the caller sends them to the ordinary sign-in page,
 * where their new account works. That matters because an invitation lives for
 * a week, and a link in an inbox for a week should not stay a way in. It also
 * means an email scanner following the link costs the client nothing, because
 * the account it created is reachable the normal way.
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const tokenHash = sha256(token)

  const outcome = await prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({
      where: { tokenHash },
      include: { project: { select: { id: true, slug: true, displayName: true } } },
    })

    if (!invite) return { ok: false as const, reason: 'unknown' as const }
    if (invite.revokedAt) return { ok: false as const, reason: 'revoked' as const }
    if (invite.acceptedAt) return { ok: false as const, reason: 'spent' as const }
    if (invite.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: 'expired' as const }

    // Someone may have been given an account by hand between the invitation
    // going out and it being opened. Reuse it rather than failing: the
    // invitation's job is to get them in, and `create` would throw on the
    // unique address.
    const user =
      (await tx.user.findUnique({ where: { email: invite.email } })) ??
      (await tx.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          // Written as a literal, not taken from the invitation. An
          // invitation cannot make a designer.
          role: Role.CLIENT,
          signInEnabled: true,
        },
      }))

    if (invite.projectId) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
        create: { projectId: invite.projectId, userId: user.id, label: invite.label },
        update: { label: invite.label ?? undefined },
      })
    }

    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })

    const sessionToken = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

    await tx.session.create({
      data: { userId: user.id, tokenHash: sha256(sessionToken), expiresAt },
    })

    return {
      ok: true as const,
      user,
      sessionToken,
      expiresAt,
      projectSlug: invite.project?.slug ?? null,
      inviteId: invite.id,
      projectId: invite.projectId,
    }
  })

  if (outcome.ok) {
    await record({
      action: AuditAction.INVITE_ACCEPTED,
      actor: outcome.user,
      projectId: outcome.projectId,
      subjectType: 'Invite',
      subjectId: outcome.inviteId,
      summary: `${outcome.user.name} accepted their invitation and signed in`,
    })
  }

  return outcome
}

/** Withdraws an invitation that has not been accepted. */
export async function revokeInvite(actor: User, inviteId: string): Promise<void> {
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } })
  if (!invite) throw new InviteError('No such invitation.')
  if (invite.acceptedAt) throw new InviteError('That one has already been accepted, so there is nothing to withdraw. Close their access in admin instead.')
  if (invite.revokedAt) return

  await prisma.invite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } })

  await record({
    action: AuditAction.INVITE_REVOKED,
    actor,
    projectId: invite.projectId,
    subjectType: 'Invite',
    subjectId: invite.id,
    summary: `${actor.name} withdrew the invitation to ${invite.email}`,
  })
}

/** Outstanding invitations, for the admin screen. */
export async function pendingInvites() {
  return prisma.invite.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { displayName: true, slug: true } } },
  })
}
