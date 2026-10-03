import type { User } from '@prisma/client'
import { AuditAction, record } from './audit'
import { prisma } from './db'
import { TRASH_DAYS, stillRestorable } from './uploads'

/**
 * The trash.
 *
 * The rule this exists to keep: nothing in this application permanently
 * deletes a client's work. Removing a file or a message sets a date on the
 * row. The row stays, and for files the object stays in the bucket too.
 *
 * What the 30 days actually mean. A file is restorable for 30 days and then
 * it drops into an older section of this screen, still there, still
 * restorable, just no longer in the way. There is deliberately no job that
 * clears it out on a timer: a timer that destroys client work while nobody is
 * watching is the thing being avoided, not the thing being built. If storage
 * ever needs reclaiming that is a decision somebody makes on purpose.
 */

export { TRASH_DAYS, stillRestorable }

export type TrashedFile = Awaited<ReturnType<typeof trashedFiles>>[number]
export type TrashedMessage = Awaited<ReturnType<typeof trashedMessages>>[number]

export async function trashedFiles() {
  return prisma.upload.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: {
      project: { select: { displayName: true, slug: true } },
      uploadedBy: { select: { name: true } },
      deletedBy: { select: { name: true } },
    },
  })
}

export async function trashedMessages() {
  return prisma.message.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: {
      project: { select: { displayName: true, slug: true } },
      author: { select: { name: true } },
    },
  })
}

export async function trashCount(): Promise<number> {
  const [files, messages] = await Promise.all([
    prisma.upload.count({ where: { deletedAt: { not: null } } }),
    prisma.message.count({ where: { deletedAt: { not: null } } }),
  ])
  return files + messages
}

export class TrashError extends Error {}

/**
 * Puts a file back where it was.
 *
 * Works whether or not the 30 days have passed. The window is about what is
 * shown first, not about what is possible: refusing to restore something that
 * is demonstrably still there would be a strange kind of unhelpful.
 */
export async function restoreFile(actor: User, uploadId: string): Promise<void> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } })
  if (!upload) throw new TrashError('No such file.')
  if (!upload.deletedAt) return

  await prisma.upload.update({
    where: { id: uploadId },
    data: { deletedAt: null, deletedById: null },
  })

  await record({
    action: AuditAction.FILE_RESTORED,
    actor,
    projectId: upload.projectId,
    subjectType: 'Upload',
    subjectId: upload.id,
    summary: `${actor.name} put ${upload.filename} back`,
  })
}

export async function restoreMessage(actor: User, messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message) throw new TrashError('No such message.')
  if (!message.deletedAt) return

  await prisma.message.update({ where: { id: messageId }, data: { deletedAt: null } })

  await record({
    action: AuditAction.FILE_RESTORED,
    actor,
    projectId: message.projectId,
    subjectType: 'Message',
    subjectId: message.id,
    summary: `${actor.name} put a message back on the thread`,
  })
}
