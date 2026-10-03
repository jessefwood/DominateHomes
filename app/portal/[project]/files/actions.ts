'use server'

import { revalidatePath } from 'next/cache'
import { alreadyNotifiedRecently, notifyDesignersOfClientActivity } from '@/lib/notify'
import { isDesigner, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import {
  beginUpload,
  confirmUpload,
  trashUpload,
  UploadError,
  type BeginUploadResult,
} from '@/lib/uploads'

/**
 * The three steps of sending a file, as three separate calls.
 *
 * A server action is a public endpoint. It does not matter that the only
 * thing that calls these is a component rendered inside a page that already
 * checked access: anybody can post to an action id. So every one of them
 * starts by proving who is asking and which project they may touch, the same
 * way the page does.
 */

type Result<T = void> = { error?: string; ok?: true; data?: T }

async function guarded<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() }
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message }
    throw error
  }
}

/** Step one: validate, reserve a row, hand back a link to upload to. */
export async function requestUpload(
  projectSlug: string,
  input: { filename: string; contentType?: string; sizeBytes: number; roomId?: string | null; caption?: string | null },
): Promise<Result<BeginUploadResult>> {
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  return guarded(() => beginUpload(user, project, input))
}

/**
 * Step three: the browser has finished PUTting, so ask the bucket what
 * arrived and count the file as real.
 *
 * Step two happens entirely in the browser and never touches this server,
 * which is the point of the whole arrangement.
 */
export async function finishUpload(projectSlug: string, uploadId: string): Promise<Result> {
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  // Asked before confirmUpload, because the throttle reads the audit log and
  // confirmUpload writes to it. See the note in lib/notify.ts: ask first,
  // then write, then send. This is what turns eleven photographs of a great
  // room into one email rather than eleven.
  const quiet = isDesigner(user) ? true : await alreadyNotifiedRecently(user.id, project.id)

  const result = await guarded(() => confirmUpload(user, uploadId))
  if (!result.ok) return { error: result.error }

  if (!quiet) {
    await notifyDesignersOfClientActivity({
      actor: user,
      project,
      what: 'sent us some files',
      path: `/portal/${project.slug}/files`,
    })
  }

  revalidatePath(`/portal/${projectSlug}/files`)
  return { ok: true }
}

export async function removeUpload(projectSlug: string, uploadId: string): Promise<Result> {
  const user = await requireUser()
  await requireProjectAccess(user, projectSlug)

  const result = await guarded(() => trashUpload(user, uploadId))
  if (result.ok) revalidatePath(`/portal/${projectSlug}/files`)
  return { error: result.error, ok: result.ok }
}
