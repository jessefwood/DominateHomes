'use server'

import { revalidatePath } from 'next/cache'
import { deleteMessage, MessageError, postMessage } from '@/lib/messages'
import { alreadyNotifiedRecently, notifyDesignersOfClientActivity } from '@/lib/notify'
import { isDesigner, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

type Result = { error?: string; ok?: true }

async function guarded(work: () => Promise<void>): Promise<Result> {
  try {
    await work()
  } catch (error) {
    if (error instanceof MessageError) return { error: error.message }
    throw error
  }
  return { ok: true }
}

export async function send(projectSlug: string, body: string): Promise<Result> {
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  // Asked before the message is written, because the throttle reads the audit
  // log and postMessage writes to it. See the note in lib/notify.ts: ask
  // first, then write, then send.
  const quiet = isDesigner(user) ? true : await alreadyNotifiedRecently(user.id, project.id)

  const result = await guarded(async () => {
    await postMessage(user, project, body)
  })

  if (!result.ok) return result

  if (!quiet) {
    await notifyDesignersOfClientActivity({
      actor: user,
      project,
      what: 'sent a message',
      path: `/portal/${project.slug}/messages`,
    })
  }

  revalidatePath(`/portal/${projectSlug}/messages`)
  return result
}

export async function remove(projectSlug: string, messageId: string): Promise<Result> {
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const result = await guarded(() => deleteMessage(user, messageId, project.id))
  if (result.ok) revalidatePath(`/portal/${projectSlug}/messages`)
  return result
}
