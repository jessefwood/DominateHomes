'use server'

import { revalidatePath } from 'next/cache'
import { OptionSlot } from '@prisma/client'
import { NothingToApproveError, signRoomApproval, UnchosenItemsError } from '@/lib/approvals'
import { requireRoomAccess, requireSelectionAccess } from '@/lib/projects'
import { chooseOption, clearChoice, SelectionLockedError } from '@/lib/selections'
import { requireUser } from '@/lib/session'

type Result = { error?: string; ok?: true }

/**
 * Every action here proves two things before it writes: the person is signed
 * in, and the record belongs to a project they may see. The second matters
 * now that there is more than one project, because an id alone is not proof
 * of anything.
 */

function explain(error: unknown, fallback: string): Result {
  if (
    error instanceof SelectionLockedError ||
    error instanceof UnchosenItemsError ||
    error instanceof NothingToApproveError
  ) {
    return { error: error.message }
  }
  console.error(fallback, error)
  return { error: fallback }
}

function refresh(projectSlug: string, roomSlug: string) {
  revalidatePath(`/portal/${projectSlug}/rooms/${roomSlug}`)
  revalidatePath(`/portal/${projectSlug}/rooms`)
  revalidatePath(`/portal/${projectSlug}/budget`)
  revalidatePath(`/portal/${projectSlug}/approvals`)
  revalidatePath(`/portal/${projectSlug}`)
}

export async function pickOption(
  selectionId: string,
  slot: 'A' | 'B' | 'C',
  projectSlug: string,
  roomSlug: string,
): Promise<Result> {
  const user = await requireUser()
  await requireSelectionAccess(user, selectionId, projectSlug)

  try {
    await chooseOption(selectionId, OptionSlot[slot])
    refresh(projectSlug, roomSlug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'That pick did not save. Try again in a moment.')
  }
}

export async function unpickOption(
  selectionId: string,
  projectSlug: string,
  roomSlug: string,
): Promise<Result> {
  const user = await requireUser()
  await requireSelectionAccess(user, selectionId, projectSlug)

  try {
    await clearChoice(selectionId)
    refresh(projectSlug, roomSlug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'That did not save. Try again in a moment.')
  }
}

/**
 * Signs off a whole room. The price snapshot happens inside signRoomApproval,
 * which is the point: what gets recorded is what was on screen when she
 * signed, not whatever the vendor charges by the time it is ordered.
 */
export async function approveRoom(
  roomId: string,
  signedByName: string,
  projectSlug: string,
  roomSlug: string,
): Promise<Result> {
  const user = await requireUser()
  await requireRoomAccess(user, roomId, projectSlug)

  const name = signedByName.trim()
  if (name.length < 2) {
    return { error: 'Type your name as your signature before approving.' }
  }

  try {
    await signRoomApproval({ roomId, userId: user.id, signedByName: name })
    refresh(projectSlug, roomSlug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'The approval did not save. Nothing was signed off.')
  }
}
