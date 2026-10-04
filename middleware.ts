import { NextResponse, type NextRequest } from 'next/server'

/**
 * Keeps the session cookie sliding, so "signed in" stays signed in.
 *
 * The session row's expiry is pushed forward on every request in
 * userForSessionToken, but the cookie carries its own expiry and the browser
 * drops it on that date no matter how alive the server side session is. So a
 * person who used the portal happily for a year would be asked to sign in
 * again on day 366 for no reason. This re-sends the same cookie with a fresh
 * year on it.
 *
 * It deliberately does no validation and touches no database. The cookie is a
 * hashed lookup that every page already checks through requireUser, so
 * extending a cookie that turns out to be invalid grants nothing: the request
 * still ends at /signin. Middleware here runs on the edge and a database read
 * would be both impossible and pointless.
 *
 * Scoped to the signed-in surfaces only. In particular it does not run on
 * /api/auth/*, which set this cookie themselves and must not have it rewritten
 * underneath them, and it skips the sign-out response that is busy deleting it.
 */
const SESSION_COOKIE = 'portal_session'
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const existing = request.cookies.get(SESSION_COOKIE)

  if (existing?.value) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: existing.value,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    })
  }

  return response
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*'],
}
