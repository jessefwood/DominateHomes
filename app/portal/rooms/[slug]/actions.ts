'use server'

import { revalidatePath } from 'next/cache'
import { OptionSlot } from '@prisma/client'
import {
  NothingToApproveError,
  signRoomApproval,
  UnchosenItemsError,
} from '@/lib/approvals'
import { prisma } from '@/lib/db'
import { chooseOption, clearChoice, SelectionLockedError } from '@/lib/selections'
import { requireUser } from '@/lib/session'

type Result = { error?: string; ok?: true }

/** Shared shape so every action reports a readable problem rather than a stack trace. */
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

function refresh(slug: string) {
  revalidatePath(`/portal/rooms/${slug}`)
  revalidatePath('/portal/rooms')
  revalidatePath('/portal/budget')
  revalidatePath('/portal/approvals')
  revalidatePath('/portal')
}

export async function pickOption(
  selectionId: string,
  slot: 'A' | 'B' | 'C',
  slug: string,
): Promise<Result> {
  await requireUser()

  try {
    await chooseOption(selectionId, OptionSlot[slot])
    refresh(slug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'That pick did not save. Try again in a moment.')
  }
}

export async function unpickOption(selectionId: string, slug: string): Promise<Result> {
  await requireUser()

  try {
    await clearChoice(selectionId)
    refresh(slug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'That did not save. Try again in a moment.')
  }
}

/**
 * Signs off a whole room. The price snapshot happens inside signRoomApproval,
 * which is the point: what gets recorded is what was on screen when she signed,
 * not whatever the vendor charges by the time it is ordered.
 */
export async function approveRoom(roomId: string, signedByName: string, slug: string): Promise<Result> {
  const user = await requireUser()

  const name = signedByName.trim()
  if (name.length < 2) {
    return { error: 'Type your name as your signature before approving.' }
  }

  try {
    await signRoomApproval({ roomId, userId: user.id, signedByName: name })
    refresh(slug)
    return { ok: true }
  } catch (error) {
    return explain(error, 'The approval did not save. Nothing was signed off.')
  }
}

/** Used by the room screen to decide whether to offer the approval form. */
export async function roomReadyToApprove(roomId: string) {
  const selections = await prisma.selection.findMany({
    where: { roomId },
    select: { chosenSlot: true },
  })
  return selections.length > 0 && selections.every((s) => s.chosenSlot !== null)
}
