import { type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { redirectTo } from '@/lib/http'
import { acceptInvite } from '@/lib/invites'

export const dynamic = 'force-dynamic'

/**
 * The target of an invitation email. Creates the account, puts them on the
 * project and signs them in, all in one click.
 *
 * An invitation that has already been accepted does not sign anybody in. It
 * sends them to the ordinary sign-in page with a message saying their account
 * is set up, which is both true and the thing they need to do next. Two
 * reasons: an invitation lives for a week and a week-long key sitting in an
 * inbox should not stay a way in, and an email scanner that follows the link
 * then costs the client nothing.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) return redirectTo('/signin?problem=missing')

  const result = await acceptInvite(token)

  if (!result.ok) {
    return redirectTo(`/signin?problem=invite-${result.reason}`)
  }

  // Straight into the project when the invitation named one, so the first
  // thing they see is their house rather than a list with one row in it.
  const response = redirectTo(result.projectSlug ? `/portal/${result.projectSlug}` : '/portal')

  response.cookies.set({
    name: SESSION_COOKIE,
    value: result.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: result.expiresAt,
  })

  return response
}
