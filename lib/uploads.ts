import { UploadKind, UploadSource, type Prisma, type Project, type Upload, type User } from '@prisma/client'
import { notFound } from 'next/navigation'
import { AuditAction, record } from './audit'
import { prisma } from './db'
import { isDesigner, requireProjectAccess } from './projects'
import {
  cleanFilename,
  contentTypeFor,
  deleteObject,
  headObject,
  signedUploadUrl,
  storageConfigured,
  uploadKey,
} from './storage'

/**
 * Files on a project: what a client sends us, and what we send back.
 *
 * The thing this is for, in Jesse's words, is "requesting pictures and videos
 * of the house when we start a project and need to know what it looks like
 * and get measurements". So the shape is built around a client standing in an
 * empty room with a phone, not around a document management system.
 *
 * The upload goes straight from the phone to the bucket. The server hands out
 * a link, the phone PUTs to it, and then the server asks the bucket what
 * arrived. That means a two minute video never passes through the application
 * at all, which matters because Railway would otherwise be holding the whole
 * thing in memory while a phone on one bar finishes sending it.
 *
 * It also means the browser is never trusted. See `confirmUpload`.
 */

/**
 * 30 days, and then it is still there.
 *
 * "Deleted" never removes a row or an object here. After 30 days a file drops
 * out of the main trash list into an older section, and removing it for good
 * is a separate deliberate action by a designer. Nothing in this application
 * destroys a client's file on a timer.
 */
export const TRASH_DAYS = 30

/**
 * Half a gigabyte.
 *
 * Enough for a couple of minutes of phone video, which is what a walkthrough
 * of a bare room actually is. Pushed much higher and the real failure stops
 * being the limit and starts being the upload dying two thirds of the way
 * through on a builder's site with no wifi, which is worse because it wastes
 * their time before telling them.
 */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

/**
 * What a client may send.
 *
 * An allowlist, not a blocklist. Everything on it is something a phone or a
 * laptop produces when somebody is trying to show us a room or send us a
 * document, and nothing on it is interpreted by a browser as code.
 *
 * SVG is the notable absence and it is deliberate. An SVG is a document that
 * can carry script, and a preview renders it. It is the one image format that
 * is really a program.
 */
export const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export class UploadError extends Error {}

/** Grouping for the screen, worked out once when the row is written. */
export function kindFor(contentType: string): UploadKind {
  if (contentType.startsWith('image/')) return UploadKind.PHOTO
  if (contentType.startsWith('video/')) return UploadKind.VIDEO
  if (
    contentType === 'application/pdf' ||
    contentType.startsWith('text/') ||
    contentType.includes('word') ||
    contentType.includes('excel') ||
    contentType.includes('spreadsheet')
  ) {
    return UploadKind.DOCUMENT
  }
  return UploadKind.OTHER
}

/** "4.2 MB". Phones produce files whose size people want to recognise. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const megabytes = bytes / (1024 * 1024)
  if (megabytes < 100) return `${megabytes.toFixed(1)} MB`
  return `${Math.round(megabytes)} MB`
}

/**
 * Settles on a content type.
 *
 * The browser's guess is used when it is one we accept, and otherwise the
 * filename decides. Phones are unreliable here: an iPhone sending a HEIC
 * through some upload paths reports an empty string or
 * `application/octet-stream`, and refusing the file at that point would mean
 * refusing most photographs taken on an iPhone.
 */
function settleType(filename: string, claimed: string | undefined): string {
  const offered = claimed?.trim().toLowerCase().split(';')[0] ?? ''
  if (offered && ALLOWED_UPLOAD_TYPES.has(offered)) return offered
  return contentTypeFor(filename)
}

export type BeginUploadInput = {
  filename: string
  contentType?: string
  sizeBytes: number
  roomId?: string | null
  caption?: string | null
}

export type BeginUploadResult = {
  uploadId: string
  /** Where the browser PUTs the bytes. Short lived. */
  url: string
}

/**
 * Reserves a row and hands back a link to upload to.
 *
 * Validation happens here, before any link exists, because the link is the
 * capability: once it is minted the bucket will accept whatever is sent to
 * it. So the size and the type are checked against what the browser claims
 * now, and then checked again against what actually arrived in
 * `confirmUpload`. The first check is a courtesy to the person uploading; the
 * second one is the one that counts.
 */
export async function beginUpload(
  user: User,
  project: Project,
  input: BeginUploadInput,
): Promise<BeginUploadResult> {
  if (!storageConfigured()) {
    throw new UploadError('Sending files is not switched on yet. Davina will let you know when it is.')
  }

  const filename = cleanFilename(input.filename)
  const contentType = settleType(filename, input.contentType)

  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new UploadError(
      'That kind of file cannot be sent through the portal. Photos, videos, PDFs and documents are fine.',
    )
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new UploadError('That file looks empty.')
  }

  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `That file is ${formatBytes(input.sizeBytes)}, and ${formatBytes(MAX_UPLOAD_BYTES)} is the limit. For a long video, send it in a couple of shorter clips.`,
    )
  }

  // A room can only be tagged if it belongs to this project. Without this a
  // client could file a photograph against another client's room, which is a
  // small leak of the fact that the room exists.
  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } })
    if (!room || room.projectId !== project.id) throw new UploadError('That room is not on this project.')
  }

  const upload = await prisma.upload.create({
    data: {
      projectId: project.id,
      uploadedById: user.id,
      roomId: input.roomId ?? null,
      // Filled in for real by confirmUpload. Written now so the columns are
      // not nullable for the sake of a state that lasts a few seconds.
      storageKey: 'pending',
      filename,
      contentType,
      sizeBytes: input.sizeBytes,
      kind: kindFor(contentType),
      source: isDesigner(user) ? UploadSource.DESIGNER : UploadSource.CLIENT,
      caption: input.caption?.trim() || null,
    },
  })

  // The key needs the row's id in it, so it can only be set once the row
  // exists. Done in two steps rather than generating an id by hand, because
  // the database's id is the one thing guaranteed unique.
  const key = uploadKey(project.id, upload.id, filename)
  await prisma.upload.update({ where: { id: upload.id }, data: { storageKey: key } })

  return { uploadId: upload.id, url: signedUploadUrl(key) }
}

/**
 * Asks the bucket what actually arrived, and only then counts the file as
 * real.
 *
 * This is the whole reason a direct upload is safe. The browser told us a
 * size and a type before it sent anything, and it was free to lie about both.
 * The bucket is not. So the size and the type stored on the row are the ones
 * the bucket reports, the limit is enforced against those, and a file that
 * came in over the limit is removed rather than kept.
 */
export async function confirmUpload(user: User, uploadId: string): Promise<Upload> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } })
  if (!upload || upload.uploadedById !== user.id) throw new UploadError('That upload is not yours.')
  if (upload.confirmedAt) return upload

  const facts = await headObject(upload.storageKey)
  if (!facts) {
    throw new UploadError('That file did not finish arriving. Have another go.')
  }

  if (facts.size > MAX_UPLOAD_BYTES) {
    // Over the limit despite what the browser claimed. Take it back out of
    // the bucket rather than leaving it sitting there costing money.
    await deleteObject(upload.storageKey).catch(() => {})
    await prisma.upload.delete({ where: { id: upload.id } })
    throw new UploadError(`That file came in at ${formatBytes(facts.size)}, over the limit.`)
  }

  // The bucket echoes back whatever content type the PUT carried, so it is
  // confirmation of what was sent rather than an independent opinion. Only
  // trusted when it is on the allowlist; otherwise the filename decides,
  // exactly as it did on the way in.
  const reported = facts.contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
  const contentType = ALLOWED_UPLOAD_TYPES.has(reported)
    ? reported
    : contentTypeFor(upload.filename)

  const confirmed = await prisma.upload.update({
    where: { id: upload.id },
    data: {
      confirmedAt: new Date(),
      sizeBytes: facts.size,
      contentType,
      kind: kindFor(contentType),
    },
  })

  await record({
    action: AuditAction.FILE_UPLOADED,
    actor: user,
    projectId: upload.projectId,
    subjectType: 'Upload',
    subjectId: upload.id,
    summary: `${user.name} sent ${upload.filename} (${formatBytes(facts.size)})`,
  })

  return confirmed
}

/** Only confirmed, untrashed files, newest first. */
export const VISIBLE_UPLOAD: Prisma.UploadWhereInput = {
  deletedAt: null,
  confirmedAt: { not: null },
}

export async function uploadsForProject(projectId: string) {
  return prisma.upload.findMany({
    where: { projectId, ...VISIBLE_UPLOAD },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } },
      room: { select: { name: true, slug: true } },
    },
  })
}

/**
 * Resolves a file and proves this person may have it.
 *
 * Not found rather than forbidden for a file on someone else's project, for
 * the same reason `requireProjectAccess` answers that way: a different answer
 * would confirm the file exists.
 */
export async function requireUploadAccess(user: User, uploadId: string) {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { project: { select: { slug: true } } },
  })

  if (!upload) notFound()

  // Goes through the project check rather than comparing ids here, so there
  // is exactly one place that decides who may see a project.
  const project = await requireProjectAccess(user, upload.project.slug)

  return { upload, project }
}

/**
 * Moves a file to the trash.
 *
 * A client may take back something they sent. A designer may bin anything on
 * a project they run. Neither removes the row or the object: see TRASH_DAYS.
 */
export async function trashUpload(user: User, uploadId: string): Promise<void> {
  const { upload } = await requireUploadAccess(user, uploadId)

  if (!isDesigner(user) && upload.uploadedById !== user.id) {
    throw new UploadError('That one was not sent by you, so it is not yours to remove.')
  }

  if (upload.deletedAt) return

  await prisma.upload.update({
    where: { id: upload.id },
    data: { deletedAt: new Date(), deletedById: user.id },
  })

  await record({
    action: AuditAction.FILE_DELETED,
    actor: user,
    projectId: upload.projectId,
    subjectType: 'Upload',
    subjectId: upload.id,
    summary: `${user.name} moved ${upload.filename} to the trash`,
  })
}

/** Puts one back. Designers only: the trash screen is in admin. */
export async function restoreUpload(user: User, uploadId: string): Promise<void> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } })
  if (!upload) throw new UploadError('No such file.')

  await prisma.upload.update({
    where: { id: upload.id },
    data: { deletedAt: null, deletedById: null },
  })

  await record({
    action: AuditAction.FILE_RESTORED,
    actor: user,
    projectId: upload.projectId,
    subjectType: 'Upload',
    subjectId: upload.id,
    summary: `${user.name} put ${upload.filename} back`,
  })
}

/** Whether a trashed file is still inside the 30 days. */
export function stillRestorable(upload: Pick<Upload, 'deletedAt'>, now = new Date()): boolean {
  if (!upload.deletedAt) return true
  return now.getTime() - upload.deletedAt.getTime() < TRASH_DAYS * 86_400_000
}
