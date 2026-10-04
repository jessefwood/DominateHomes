'use server'

import { redirect } from 'next/navigation'
import { AccessRequestError, requestAccess } from '@/lib/access-requests'

/**
 * Takes FormData and finishes with a redirect, for the same reason the
 * sign-in form does: a browser holding a page from before a deploy never
 * hydrates, and a plain form post is the only thing that still reaches the
 * server. The outcome goes in the query string so it survives the reload.
 */
export async function submitRequest(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '')
  const email = String(formData.get('email') ?? '')
  const phone = String(formData.get('phone') ?? '')
  const note = String(formData.get('note') ?? '')

  let outcome = '/request-access?sent=1'

  try {
    await requestAccess({ name, email, phone, note })
  } catch (error) {
    if (error instanceof AccessRequestError) {
      outcome = `/request-access?problem=${encodeURIComponent(error.message)}`
    } else {
      console.error('Access request failed', error)
      outcome = '/request-access?problem=failed'
    }
  }

  redirect(outcome)
}
