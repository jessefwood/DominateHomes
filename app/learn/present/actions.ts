'use server'

import { endLive, LiveError, presentStep } from '@/lib/course'
import { requireDesigner } from '@/lib/session'

/**
 * Moving the class. Designers only, checked here as well as by the page,
 * because a server action is reachable without the page.
 */

type Result = { error?: string; ok?: true }

export async function presentStepAction(courseSlug: string, moduleKey: string, step: number): Promise<Result> {
  const user = await requireDesigner()
  try {
    await presentStep(user, courseSlug, moduleKey, step)
    return { ok: true }
  } catch (error) {
    if (error instanceof LiveError) return { error: error.message }
    throw error
  }
}

export async function endLiveAction(courseSlug: string): Promise<Result> {
  const user = await requireDesigner()
  await endLive(user, courseSlug)
  return { ok: true }
}
