'use server'

import { redirect } from 'next/navigation'
import { RateLimitedError, requestSignInLink } from '@/lib/auth'
import { AppUrlError, appUrl } from '@/lib/session'

/**
 * Takes FormData and finishes with a redirect, so the sign-in form works with
 * or without JavaScript.
 *
 * Why it is built this way. The original was a button with an onClick, which
 * does nothing until React has hydrated. A browser holding a page from before
 * a deploy gets 404s for its script chunks, never hydrates, and the click
 * falls through to a plain form post that reloads the page with no message
 * and no email. That is exactly the silent failure seen on the live site, and
 * no error handling inside the click handler can catch it, because the
 * handler never ran.
 *
 * useActionState was the obvious fix and it is not enough: without a
 * permalink it does not progressively enhance, and a no-JS submit never
 * reaches the server at all. Tested, it did not. A plain form action plus a
 * redirect does reach the server, every time, which is the whole point.
 *
 * The outcome goes in the query string rather than client state so the result
 * survives the page reload that a no-JS submit causes.
 */
export async function requestLink(formData: FormData): Promise<void> {
  const value = String(formData.get('email') ?? '').trim()

  if (!value || !value.includes('@') || value.length > 320) {
    redirect('/signin?problem=address')
  }

  let outcome = '/signin?sent=1'

  try {
    // Whether the address is on a project is deliberately discarded: the
    // browser gets the same answer either way, so this page cannot be used to
    // find out who has access.
    await requestSignInLink(value, appUrl())
  } catch (error) {
    if (error instanceof RateLimitedError) {
      outcome = '/signin?problem=toomany'
    } else if (error instanceof AppUrlError) {
      // The base address is wrong, so any link built from it would be dead on
      // arrival. Better to send nothing and say so than to email somebody a
      // link that cannot work, which reads to them as their own fault.
      //
      // The message to the browser does not repeat what is misconfigured. The
      // person reading it cannot act on that, and it is not a detail to put in
      // front of whoever types an address into a public form. The real
      // explanation goes to the server log and to admin.
      console.error('Sign-in link not sent:', error.message)
      outcome = '/signin?problem=misconfigured'
    } else {
      console.error('Sign-in link failed', error)
      outcome = '/signin?problem=failed'
    }
  }

  redirect(outcome)
}
