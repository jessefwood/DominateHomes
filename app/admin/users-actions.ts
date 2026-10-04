'use server'

import { revalidatePath } from 'next/cache'
import { Role } from '@prisma/client'
import { AuditAction, record } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { requireDesigner } from '@/lib/session'

/**
 * Opening and closing a client's access.
 *
 * This exists because the rule "Abbie does not get in until the proposal and
 * the agreement exist" was enforced in the seed, and the seed only runs on an
 * empty database. When signInEnabled was added by migration, every row that
 * already existed took the column default, which is true. So production ended
 * up with her able to sign in, exactly the thing the flag was added to
 * prevent.
 *
 * A rule that only holds if the data was created in the right order is not a
 * rule. Making it a switch in admin means it can be set at any time, by the
 * person whose decision it actually is.
 */

type Result = { error?: string; ok?: true }

export async function setSignIn(userId: string, enabled: boolean): Promise<Result> {
  const actor = await requireDesigner()

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return { error: 'No such person.' }

  // Locking yourself out of the admin screen you are standing in is a
  // mistake nobody means to make.
  if (target.id === actor.id && !enabled) {
    return { error: 'You cannot lock yourself out. Ask the other designer to do it.' }
  }

  if (target.role === Role.DESIGNER && !enabled) {
    const otherOpenDesigners = await prisma.user.count({
      where: { role: Role.DESIGNER, signInEnabled: true, id: { not: target.id } },
    })
    if (otherOpenDesigners === 0) {
      return { error: 'That is the last designer who can sign in. Open another one first.' }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { signInEnabled: enabled } })

  // Closing someone's access should end the sessions they already have,
  // otherwise "locked out" only means "cannot get a new link".
  if (!enabled) {
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.loginToken.deleteMany({ where: { userId, usedAt: null } })
  }

  // Who opened or closed somebody's access, and when, is the single most
  // useful thing in the log: it is the question that gets asked months later
  // when a client says she could not get in.
  await record({
    action: enabled ? AuditAction.ACCESS_OPENED : AuditAction.ACCESS_CLOSED,
    actor,
    subjectType: 'User',
    subjectId: target.id,
    summary: `${actor.name} ${enabled ? 'opened' : 'closed'} access for ${target.name} (${target.email})`,
  })

  revalidatePath('/admin')
  revalidatePath('/admin/activity')
  return { ok: true }
}
