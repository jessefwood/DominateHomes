import { AuditAction, Role, type Project, type User } from '@prisma/client'
import { prisma } from './db'
import { accessRequestEmail, clientActivityEmail, clientNudgeEmail, mailer } from './mailer'
import { reachableClients } from './open-items'
import { appUrl } from './session'

/**
 * Telling the design side something happened, without burying them.
 *
 * A client uploading eleven photographs of a great room is one event, not
 * eleven. So activity emails are throttled to one per person per project per
 * quarter of an hour, and the email says so, which is what stops the second
 * one being missed when it does not arrive.
 *
 * HOW THE THROTTLE WORKS, AND THE ORDERING IT DEPENDS ON. There is no
 * separate table of sent notifications. The audit log already records every
 * upload and every message, so `alreadyNotifiedRecently` asks it whether
 * anything of the same kind happened in the window. That makes the caller's
 * order load bearing: ask first, then write the audit event, then send. Ask
 * after writing and the event you just wrote is the one it finds, and nothing
 * is ever sent.
 *
 * Nothing in here is allowed to fail the thing it is reporting on. A client's
 * photograph uploads whether or not Resend is reachable.
 */

export const NOTIFY_WINDOW_MINUTES = 15

/** The actions that count as "we already told them about this person". */
const THROTTLED: AuditAction[] = [AuditAction.FILE_UPLOADED, AuditAction.MESSAGE_SENT]

/**
 * Who hears about it: every designer who can sign in.
 *
 * Read from the database rather than from a configured address, so adding
 * Jesse to the project is all it takes for Jesse to start hearing about it.
 */
async function designerEmails(): Promise<string[]> {
  const designers = await prisma.user.findMany({
    where: { role: Role.DESIGNER, signInEnabled: true },
    select: { email: true },
  })
  return designers.map((designer) => designer.email)
}

/**
 * Whether this person already set something off on this project inside the
 * window. Call this BEFORE recording the new audit event.
 */
export async function alreadyNotifiedRecently(actorId: string, projectId: string): Promise<boolean> {
  const since = new Date(Date.now() - NOTIFY_WINDOW_MINUTES * 60_000)

  const recent = await prisma.auditEvent.count({
    where: { actorId, projectId, action: { in: THROTTLED }, createdAt: { gte: since } },
  })

  return recent > 0
}

/**
 * One email per designer about something a client did.
 *
 * `what` finishes the sentence "Abbie ...", so it reads as
 * "Abbie sent 3 photos". Lowercase, no full stop.
 */
export async function notifyDesignersOfClientActivity({
  actor,
  project,
  what,
  path,
}: {
  actor: Pick<User, 'id' | 'name' | 'email'>
  project: Pick<Project, 'id' | 'displayName' | 'slug'>
  what: string
  path: string
}): Promise<void> {
  try {
    const recipients = (await designerEmails()).filter((email) => email !== actor.email)
    if (recipients.length === 0) return

    const link = `${appUrl()}${path}`
    const send = mailer()

    await Promise.all(
      recipients.map((to) =>
        send.send(clientActivityEmail(to, actor.name, project.displayName, what, link)),
      ),
    )
  } catch (error) {
    // Reported, never raised. See the note at the top of this file.
    console.error('Could not send a client activity email', error)
  }
}

/**
 * One email per designer about somebody asking to be let in.
 *
 * Not throttled. A request for access is rare, it is the start of a
 * conversation with a person, and the cost of missing one is losing the job.
 */
export async function notifyDesignersOfAccessRequest(request: {
  name: string
  email: string
  phone?: string | null
  note?: string | null
}): Promise<void> {
  try {
    const recipients = await designerEmails()
    if (recipients.length === 0) return

    const link = `${appUrl()}/admin/people`
    const send = mailer()

    await Promise.all(recipients.map((to) => send.send(accessRequestEmail(to, request, link))))
  } catch (error) {
    console.error('Could not send an access request email', error)
  }
}


/**
 * Telling the clients on a project that the design side needs them.
 *
 * The mirror of `notifyDesignersOfClientActivity`, and it was missing, which
 * meant Davina could post a message or ask a question and the client would
 * find out only by happening to open the portal. A thread nobody is told
 * about is a thread nobody reads.
 *
 * Not throttled, unlike the designer-facing one, and the difference is
 * deliberate. A client sending eleven photographs is one burst of one
 * person's attention. Davina asking two questions in an afternoon is two
 * things that each need an answer, and silently dropping the second one
 * because the first was recent is how a client misses the question that holds
 * up an order. The volume is low enough that honesty beats tidiness here.
 *
 * Only reaches clients who can actually sign in. See reachableClients.
 */
export async function notifyClientsOfDesignerActivity({
  project,
  headline,
  body,
  path,
  linkLabel,
}: {
  project: Pick<Project, 'id' | 'displayName' | 'slug'>
  /** Finishes "Hi Abbie, ...". Lowercase, no full stop. */
  headline: string
  /** The question or the message itself, so it can be read without clicking. */
  body: string
  path: string
  linkLabel: string
}): Promise<void> {
  try {
    const clients = await reachableClients(project.id)
    if (clients.length === 0) return

    const link = `${appUrl()}${path}`
    const send = mailer()

    await Promise.all(
      clients.map((client) =>
        send.send(
          clientNudgeEmail(
            client.email,
            client.name,
            project.displayName,
            headline,
            body,
            link,
            linkLabel,
          ),
        ),
      ),
    )
  } catch (error) {
    // Reported, never raised. Asking the question has to succeed whether or
    // not the email about it does, or Davina loses the question too.
    console.error('Could not send a client notification', error)
  }
}
