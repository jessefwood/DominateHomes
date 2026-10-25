'use server'

import { InviteRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { InviteError, sendInvite } from '@/lib/invites'
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
