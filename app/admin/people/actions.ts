'use server'

import { revalidatePath } from 'next/cache'
import {
  AccessRequestError,
  approveAccessRequest,
  declineAccessRequest,
} from '@/lib/access-requests'
import { InviteError, revokeInvite, sendInvite } from '@/lib/invites'
import { MailerError } from '@/lib/mailer'
import { appUrl, requireDesigner } from '@/lib/session'

/**
 * Letting people in.
 *
 * Every one of these calls `requireDesigner` itself. A server action is a
 * public endpoint: the fact that the only page rendering these forms is
 * behind the admin layout does not stop anybody posting to an action id, so
 * the layout's check protects the page and this one protects the write.
 */

type Result = { error?: string; ok?: true; note?: string }

async function guarded(work: () => Promise<void>): Promise<Result> {
  try {
    await work()
  } catch (error) {
    if (error instanceof InviteError || error instanceof AccessRequestError) {
      return { error: error.message }
    }
    // Worth its own message. A failed invitation is almost always the sending
    // domain rather than anything about the person being invited, and
    // "something went wrong" sends somebody looking in the wrong place.
    if (error instanceof MailerError) {
      return {
        error:
          'The invitation could not be emailed, so nothing was sent. That is usually the email settings rather than anything you did. Check Resend in integrations.',
      }
    }
    throw error
  }

  refresh()
  return { ok: true }
}

function refresh() {
  revalidatePath('/admin/people')
  revalidatePath('/admin')
}

export async function invite(values: {
  email: string
  name: string
  projectId?: string | null
  label?: string | null
}): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(async () => {
    await sendInvite(actor, appUrl(), values)
  })
}

export async function withdrawInvite(inviteId: string): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(() => revokeInvite(actor, inviteId))
}

export async function approveRequest(requestId: string, projectId: string | null): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(() => approveAccessRequest(actor, requestId, appUrl(), projectId))
}

export async function declineRequest(requestId: string, note?: string): Promise<Result> {
  const actor = await requireDesigner()
  return guarded(() => declineAccessRequest(actor, requestId, note))
}
