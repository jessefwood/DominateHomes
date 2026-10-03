import type { Message, Project, User } from '@prisma/client'
import { AuditAction, record } from './audit'
import { prisma } from './db'
import { isDesigner } from './projects'

/**
 * The thread on a project.
 *
 * Scoped to the house rather than to a pair of people, which is the one
 * decision in here worth defending. A client should not have to remember
 * which of us she told about the ceiling fan, and we should not have to
 * forward each other screenshots. Both designers see and answer the same
 * thread.
 *
 * The body is plain text and is rendered as plain text, with line breaks
 * preserved and nothing else interpreted. There is no markdown, no link
 * detection and no HTML, because none of those are worth a stored
 * cross-site-scripting hole on a page that shows a client her own budget.
 */

/**
 * Long enough for somebody to explain a problem properly, short enough that
 * it is a message and not an attachment. Anything longer wants to be a file,
 * and there is now somewhere to put one.
 */
export const MAX_MESSAGE_LENGTH = 5000

export class MessageError extends Error {}

export async function messagesForProject(projectId: string) {
  return prisma.message.findMany({
    where: { projectId, deletedAt: null },
    // Oldest first. A thread is read downwards.
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, role: true } } },
  })
}

/** Writes one. The caller has already proved access to the project. */
export async function postMessage(
  user: User,
  project: Pick<Project, 'id' | 'displayName'>,
  rawBody: string,
): Promise<Message> {
  const body = rawBody.trim()

  if (!body) throw new MessageError('Nothing to send.')
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new MessageError(
      `That is longer than a message wants to be. Keep it under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters, or send it as a file.`,
    )
  }

  const message = await prisma.message.create({
    data: {
      projectId: project.id,
      authorId: user.id,
      body,
      // Your own message is read by you by definition. Stamping the side the
      // author is on keeps the unread count from counting what you just sent.
      readByDesignerAt: isDesigner(user) ? new Date() : null,
      readByClientAt: isDesigner(user) ? null : new Date(),
    },
  })

  await record({
    action: AuditAction.MESSAGE_SENT,
    actor: user,
    projectId: project.id,
    subjectType: 'Message',
    subjectId: message.id,
    summary: `${user.name} sent a message on ${project.displayName}`,
  })

  return message
}

/**
 * Stamps everything on the thread as seen by this side.
 *
 * Called when the page is opened. Deliberately one timestamp per side rather
 * than per person: with two designers on a project, "Davina has read it" and
 * "Jesse has read it" are not worth the rows, and what the client wants to
 * know is whether anybody has.
 */
export async function markThreadRead(user: User, projectId: string): Promise<void> {
  const field = isDesigner(user) ? 'readByDesignerAt' : 'readByClientAt'

  await prisma.message.updateMany({
    where: { projectId, deletedAt: null, [field]: null, authorId: { not: user.id } },
    data: { [field]: new Date() },
  })
}

/** How many on this thread this side has not seen. */
export async function unreadCount(user: User, projectId: string): Promise<number> {
  const field = isDesigner(user) ? 'readByDesignerAt' : 'readByClientAt'

  return prisma.message.count({
    where: { projectId, deletedAt: null, [field]: null, authorId: { not: user.id } },
  })
}

/**
 * Takes a message back.
 *
 * Your own, or anything on a project you run. Sets a date rather than
 * removing the row, same as a file.
 */
export async function deleteMessage(user: User, messageId: string, projectId: string): Promise<void> {
  const message = await prisma.message.findUnique({ where: { id: messageId } })

  // Checked against the project the caller already proved access to, so a
  // message id from another project cannot be reached by guessing.
  if (!message || message.projectId !== projectId) throw new MessageError('No such message.')

  if (!isDesigner(user) && message.authorId !== user.id) {
    throw new MessageError('That one is not yours to remove.')
  }

  if (message.deletedAt) return

  await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })
}
