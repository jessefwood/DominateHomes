import { AccessRequestStatus, type User } from '@prisma/client'
import { AuditAction, record } from './audit'
import { normaliseEmail } from './auth'
import { prisma } from './db'
import { sendInvite } from './invites'
import { notifyDesignersOfAccessRequest } from './notify'

/**
 * The public "ask to be let in" form, and what happens to what it collects.
 *
 * Worth being clear about what this is not. It is not a sign-up. An
 * AccessRequest row holds no credential and grants nothing at all: it is a
 * message with a status on it. Approving one sends an invitation, and the
 * invitation is the thing that lets somebody in. Keeping the decision and the
 * credential in two different places is what makes "approved by accident"
 * recoverable.
 *
 * Because the form is public, everything here assumes the input is hostile:
 * every field is length-capped before it is stored, the note is rendered as
 * text and escaped into the notification email, and the answer to the browser
 * is the same whether or not the address is already known.
 */

export class AccessRequestError extends Error {}

/** Caps, so a public form cannot be used to write a novel into the database. */
const LIMITS = { name: 120, email: 320, phone: 40, note: 2000 }

/**
 * How often one address can ask.
 *
 * Long enough that the form cannot be used to send us a hundred emails, short
 * enough that somebody who typed their address wrong is not locked out of
 * trying again for a day.
 */
export const REQUEST_WINDOW_MINUTES = 30

export type RequestAccessInput = {
  name: string
  email: string
  phone?: string
  note?: string
}

/**
 * Records a request and tells the design side.
 *
 * Deliberately returns nothing useful. The page shows the same message
 * whatever happened, so the form cannot be used to find out who already has
 * an account or who has asked before.
 */
export async function requestAccess(input: RequestAccessInput): Promise<void> {
  const email = normaliseEmail(input.email)
  const name = input.name.trim().slice(0, LIMITS.name)

  if (!email.includes('@') || email.length > LIMITS.email) {
    throw new AccessRequestError('That does not look like an email address.')
  }
  if (!name) throw new AccessRequestError('Put in your name so we know who we are talking to.')

  const since = new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60_000)
  const recent = await prisma.accessRequest.count({
    where: { email, createdAt: { gte: since } },
  })

  // Quietly does nothing. Saying "you already asked" would turn the form into
  // a way of checking whether an address is on the list.
  if (recent > 0) return

  const created = await prisma.accessRequest.create({
    data: {
      email,
      name,
      phone: input.phone?.trim().slice(0, LIMITS.phone) || null,
      note: input.note?.trim().slice(0, LIMITS.note) || null,
    },
  })

  await record({
    action: AuditAction.ACCESS_REQUESTED,
    actorEmail: email,
    subjectType: 'AccessRequest',
    subjectId: created.id,
    summary: `${name} (${email}) asked for access`,
  })

  await notifyDesignersOfAccessRequest(created)
}

export async function pendingAccessRequests() {
  return prisma.accessRequest.findMany({
    where: { status: AccessRequestStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  })
}

export async function pendingAccessRequestCount(): Promise<number> {
  return prisma.accessRequest.count({ where: { status: AccessRequestStatus.PENDING } })
}

/**
 * Approves a request by sending an invitation.
 *
 * The invitation is what grants access, so if sending it fails the request
 * stays pending rather than being marked approved with nothing behind it.
 * That is why the status is written after `sendInvite` and not before.
 */
export async function approveAccessRequest(
  actor: User,
  requestId: string,
  baseUrl: string,
  projectId: string | null,
): Promise<void> {
  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new AccessRequestError('No such request.')
  if (request.status !== AccessRequestStatus.PENDING) {
    throw new AccessRequestError('That one has already been dealt with.')
  }

  await sendInvite(actor, baseUrl, {
    email: request.email,
    name: request.name,
    projectId,
  })

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: AccessRequestStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    },
  })

  await record({
    action: AuditAction.ACCESS_APPROVED,
    actor,
    projectId,
    subjectType: 'AccessRequest',
    subjectId: requestId,
    summary: `${actor.name} approved ${request.name} (${request.email}) and sent an invitation`,
  })
}

/**
 * Declines a request.
 *
 * Sends nothing. There is no email that makes "no" land well from a company
 * somebody has not met, and an automated rejection is worse than silence. The
 * note is for our own records.
 */
export async function declineAccessRequest(
  actor: User,
  requestId: string,
  note?: string,
): Promise<void> {
  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new AccessRequestError('No such request.')
  if (request.status !== AccessRequestStatus.PENDING) {
    throw new AccessRequestError('That one has already been dealt with.')
  }

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: AccessRequestStatus.DECLINED,
      reviewedAt: new Date(),
      reviewedById: actor.id,
      reviewNote: note?.trim().slice(0, LIMITS.note) || null,
    },
  })

  await record({
    action: AuditAction.ACCESS_DECLINED,
    actor,
    subjectType: 'AccessRequest',
    subjectId: requestId,
    summary: `${actor.name} declined ${request.name} (${request.email})`,
  })
}
