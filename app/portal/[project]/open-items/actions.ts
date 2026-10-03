'use server'

import { revalidatePath } from 'next/cache'
import { OpenItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOpenItemAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export async function answerOpenItem(itemId: string, answer: string, projectSlug: string) {
  const trimmed = answer.trim()
  if (!trimmed) return { error: 'Put something in the box first.' }
  if (trimmed.length > 2000) {
    return { error: 'That is longer than this box can take. Send it to Davina directly.' }
  }

  const user = await requireUser()
  // Proves the item belongs to a project this person may see. Without it, an
  // id from another client's project would be answerable by anyone signed in.
  await requireOpenItemAccess(user, itemId, projectSlug)

  await prisma.openItem.update({
    where: { id: itemId },
    data: {
      answer: trimmed,
      answeredAt: new Date(),
      answeredByUserId: user.id,
      status: OpenItemStatus.ANSWERED,
    },
  })

  revalidatePath(`/portal/${projectSlug}/open-items`)
  revalidatePath(`/portal/${projectSlug}`)
  return { ok: true }
}
