import type { NextRequest } from 'next/server'

/**
 * Checking that a request came from our own pages.
 *
 * Server actions already have this: Next refuses one whose Origin does not
 * match its Host. Route handlers do not, so a handler that changes something
 * has to say so itself. Today that is sign-out, which is a POST.
 *
 * The session cookie is `sameSite: lax`, which means a cross-site POST does
 * not carry it and the handler would find nobody signed in anyway. This is
 * the second lock rather than the only one, and it is here because `lax` is a
 * browser's promise rather than ours.
 *
 * NOT FOR THE STRIPE WEBHOOK. That one is cross-origin by design: it arrives
 * from Stripe with no Origin at all, and what proves it genuine is the
 * signature on the body. Applying this to it would reject every real
 * payment notification.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')

  // No Origin header at all. Browsers send one on every POST, so this is
  // either a non-browser or a browser old enough that `sameSite` is doing the
  // work instead. Refused, because the only POST this guards is a button on
  // one of our own pages.
  if (!origin) return false

  // Compared against the host the browser actually asked for. Railway
  // forwards to localhost:8080 inside the container, so `request.url` is the
  // wrong thing to read here and the forwarded host is the right one. Same
  // reasoning as lib/http.ts.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
