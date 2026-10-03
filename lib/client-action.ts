'use client'

/**
 * Calling a server action without the failure being silent.
 *
 * Every form in here did `const result = await someAction(...)` inside a
 * transition. That handles an action which *returns* an error. It does
 * nothing for an action that *rejects*, and a rejected action is the common
 * case in production: a page loaded before a deploy posts to an action id
 * that no longer exists, the request 404s, the promise rejects, and the user
 * sees absolutely nothing happen. No message, no result, no clue.
 *
 * That is what happened on the live sign-in screen and it cost an hour of
 * diagnosis, because "nothing happened" is the one symptom that carries no
 * information.
 *
 * `runAction` turns every outcome into a message. The stale-deploy case gets
 * copy that tells a non-technical person what to actually do about it.
 */

export type ActionResult = { error?: string; note?: string; ok?: true }

const STALE_DEPLOY =
  'This page is out of date because the site was just updated. Refresh and try again.'

const UNREACHABLE =
  'That did not reach us. Check your connection and try again, and tell Davina if it keeps happening.'

function describe(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

  // Next returns a 404 for an action id it no longer knows about, which is
  // exactly what a cached page does after a deploy.
  if (/404|Failed to find Server Action|not found/i.test(text)) return STALE_DEPLOY
  if (/fetch|network|load failed/i.test(text)) return UNREACHABLE

  return 'Something went wrong there. Try again, and tell Davina if it keeps happening.'
}

export async function runAction(call: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await call()) ?? {}
  } catch (error) {
    // Still worth the console line: a developer gets the real error, the
    // person using the site gets something they can act on.
    console.error('Server action failed', error)
    return { error: describe(error) }
  }
}
