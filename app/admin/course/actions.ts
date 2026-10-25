'use server'

import { InviteRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { InviteError, sendInvite } from '@/lib/invites'
import { AnswerError, COURSES, savePlanAnswerFor } from '@/lib/course'
import { prisma } from '@/lib/db'
import { parseStartingNumbers } from '@/lib/plan'
import { parseRoster } from '@/lib/roster'
import { MailerError } from '@/lib/mailer'
import { appUrl, requireDesigner } from '@/lib/session'

/**
 * Inviting agents to the course, several at once.
 *
 * Each line is sent on its own and reported on its own: one typo should not
 * stop the other eleven invitations going out.
 */

export type LineResult = { line: string; ok: boolean; message: string }

export async function inviteAgents(text: string): Promise<{ results: LineResult[] }> {
  const actor = await requireDesigner()
  const base = appUrl()
  const results: LineResult[] = []

  for (const entry of parseRoster(text)) {
    if (!entry.email) {
      results.push({ line: entry.line, ok: false, message: 'No email address on this line.' })
      continue
    }
    try {
      await sendInvite(actor, base, { name: entry.name, email: entry.email, role: InviteRole.AGENT })
      results.push({ line: entry.line, ok: true, message: `Invitation sent to ${entry.email}.` })
    } catch (error) {
      if (error instanceof InviteError) {
        results.push({ line: entry.line, ok: false, message: error.message })
      } else if (error instanceof MailerError) {
        results.push({
          line: entry.line,
          ok: false,
          message: 'Could not be emailed, so nothing was sent. That is usually the email settings, not the address.',
        })
      } else {
        throw error
      }
    }
  }

  revalidatePath('/admin/course')
  revalidatePath('/admin/people')
  return { results }
}

/** Davina working in an agent's plan with them. Never the private section. */
export async function savePlanForAction(
  agentId: string,
  fieldKey: string,
  value: unknown,
): Promise<{ error?: string; ok?: true }> {
  const actor = await requireDesigner()
  const owner = await prisma.user.findUnique({ where: { id: agentId } })
  if (!owner) return { error: 'That agent is not on the roster any more.' }
  try {
    await savePlanAnswerFor(actor, owner, COURSES[0].slug, fieldKey, value)
  } catch (error) {
    if (error instanceof AnswerError) return { error: error.message }
    throw error
  }
  return { ok: true }
}

/**
 * Loading where each agent's plan starts, pasted from the team workbook.
 *
 * Replaces what was there for that address. It only sets the starting point:
 * anything an agent has already typed into their plan stays, because their
 * own answer always wins over the starting number.
 */
export async function saveStartingNumbers(text: string): Promise<{ results: LineResult[] }> {
  await requireDesigner()
  const results: LineResult[] = []

  for (const entry of parseStartingNumbers(text)) {
    if (!entry.values) {
      results.push({
        line: entry.line,
        ok: false,
        message: 'Needs an email address and six numbers. Leave the commas out of the numbers themselves.',
      })
      continue
    }
    const v = entry.values
    const data = {
      closings2026: Math.round(v.closings2026),
      listingSides: Math.round(v.listingSides),
      buyerSides: Math.round(v.buyerSides),
      takeHomeCents: Math.round(v.takeHome * 100),
      databaseCount: Math.round(v.databaseCount),
      target2027: Math.round(v.target2027),
    }
    await prisma.planStart.upsert({ where: { email: entry.email }, create: { email: entry.email, ...data }, update: data })

    const agent = await prisma.user.findUnique({ where: { email: entry.email } })
    results.push({
      line: entry.line,
      ok: true,
      message: agent
        ? `Loaded for ${agent.name}.`
        : `Loaded for ${entry.email}. It will be waiting when they accept their invitation.`,
    })
  }

  revalidatePath('/admin/course')
  return { results }
}

