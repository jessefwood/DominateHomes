'use server'

import { revalidatePath } from 'next/cache'
import { restoreFile, restoreMessage, TrashError } from '@/lib/trash'
import { requireDesigner } from '@/lib/session'

type Result = { error?: string; ok?: true }

async function guarded(work: () => Promise<void>): Promise<Result> {
  try {
    await work()
  } catch (error) {
    if (error instanceof TrashError) return { error: error.message }
    throw error
  }

  revalidatePath('/admin/trash')
  revalidatePath('/admin')
  return { ok: true }
}

export async function putFileBack(uploadId: string): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(() => restoreFile(actor, uploadId))
}

export async function putMessageBack(messageId: string): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(() => restoreMessage(actor, messageId))
}
