'use server'

import { revalidatePath } from 'next/cache'
import { AnswerError, saveAnswer, turnIn } from '@/lib/course'
import { requireUser } from '@/lib/session'

/**
 * The two things an agent writes: an answer, and "I'm done".
 *
 * Both act on whoever is signed in and take no user id, so a request edited
 * in the browser cannot write into somebody else's homework. See saveAnswer.
 */

type Result = { error?: string; ok?: true; turnedInAt?: string }

export async function saveAnswerAction(
  courseSlug: string,
  moduleKey: string,
  fieldKey: string,
  value: unknown,
): Promise<Result> {
  const user = await requireUser()
  try {
    await saveAnswer(user, courseSlug, moduleKey, fieldKey, value)
  } catch (error) {
    if (error instanceof AnswerError) return { error: error.message }
    throw error
  }
  // Deliberately no revalidatePath. This runs on every pause in typing, and
  // the page already shows what was typed.
  return { ok: true }
}

export async function turnInAction(courseSlug: string, moduleKey: string): Promise<Result> {
  const user = await requireUser()
  try {
    const at = await turnIn(user, courseSlug, moduleKey)
    revalidatePath(`/learn/${courseSlug}`)
    revalidatePath('/admin/course')
    return { ok: true, turnedInAt: at.toISOString() }
  } catch (error) {
    if (error instanceof AnswerError) return { error: error.message }
    throw error
  }
}
