import { AuditAction, type User } from '@prisma/client'
import { prisma } from './db'

/**
 * The record of what happened.
 *
 * Two rules, and the first one is the reason this is a function rather than a
 * `prisma.auditEvent.create` at each call site:
 *
 * 1. RECORDING MUST NEVER BREAK THE THING IT IS RECORDING. Every write here
 *    is wrapped. If the log is unwritable, a client still gets signed in and
 *    her photographs still upload, and the failure goes to the server console
 *    where we will see it. An audit log that can take the portal down is a
 *    liability, not a safeguard.
 *
 * 2. THE SUMMARY IS WRITTEN FOR A PERSON, HERE, AT THE TIME. The screen shows
 *    the stored line as-is rather than reassembling a sentence from columns
 *    later. Names change, accounts get closed, projects get renamed, and a
 *    log that re-renders itself from live data stops being a record of what
 *    happened.
 *
 * Deliberately not an audit of every write. Downloads are not logged: a
 *  gallery of forty photographs would write forty rows per visit and bury the
 * things worth seeing. What is here is getting in, being let in, and anything
 * that moves or removes a client's file.
 */

export { AuditAction }

type RecordInput = {
  action: AuditAction
  summary: string
  actor?: Pick<User, 'id' | 'email'> | null
  /** For events with no account behind them, e.g. a request for access. */
  actorEmail?: string | null
  projectId?: string | null
  subjectType?: string | null
  subjectId?: string | null
}

export async function record(input: RecordInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        summary: input.summary,
        actorId: input.actor?.id ?? null,
        actorEmail: input.actorEmail ?? input.actor?.email ?? null,
        projectId: input.projectId ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
      },
    })
  } catch (error) {
    console.error('Could not write an audit event', input.action, error)
  }
}

/**
 * How far back the activity screen looks by default. Long enough to answer
 * "who let them in" about a project that started last season.
 */
export const ACTIVITY_DAYS = 180

/** Human labels, so the screen does not render SIGN_IN_REQUESTED at anybody. */
export const AUDIT_LABEL: Record<AuditAction, string> = {
  SIGN_IN_REQUESTED: 'Sign-in link asked for',
  SIGNED_IN: 'Signed in',
  SIGNED_OUT: 'Signed out',
  ACCESS_OPENED: 'Access opened',
  ACCESS_CLOSED: 'Access closed',
  INVITE_SENT: 'Invitation sent',
  INVITE_ACCEPTED: 'Invitation accepted',
  INVITE_REVOKED: 'Invitation withdrawn',
  ACCESS_REQUESTED: 'Access asked for',
  ACCESS_APPROVED: 'Access approved',
  ACCESS_DECLINED: 'Access declined',
  FILE_UPLOADED: 'File sent',
  FILE_DELETED: 'File moved to trash',
  FILE_RESTORED: 'File put back',
  MESSAGE_SENT: 'Message sent',
}
