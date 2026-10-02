'use server'

import { revalidatePath } from 'next/cache'
import { OpenItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/session'

export async function answerOpenItem(itemId: string, answer: string) {
  const trimmed = answer.trim()
  if (!trimmed) return { error: 'Put something in the box first.' }
  if (trimmed.length > 2000) return { error: 'That is longer than this box can take. Send it to Davina directly.' }

  const user = await currentUser()

  await prisma.openItem.update({
    where: { id: itemId },
    data: {
      answer: trimmed,
      answeredAt: new Date(),
      answeredByUserId: user.id,
      status: OpenItemStatus.ANSWERED,
    },
  })

  revalidatePath('/open-items')
  revalidatePath('/')
  return { ok: true }
}
