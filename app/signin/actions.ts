'use server'

import { RateLimitedError, requestSignInLink } from '@/lib/auth'
import { appUrl } from '@/lib/session'

export async function requestLink(email: string): Promise<{ error?: string }> {
  const value = email.trim()

  if (!value || !value.includes('@') || value.length > 320) {
    return { error: 'That does not look like an email address.' }
  }

  try {
    // The result says whether a user exists. It is deliberately thrown away:
    // the browser gets the same answer either way, so this page cannot be used
    // to find out who is on the project.
    await requestSignInLink(value, appUrl())
    return {}
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return { error: error.message }
    }
    console.error('Sign-in link failed', error)
    return { error: 'Something went wrong sending that. Try again in a moment.' }
  }
}
