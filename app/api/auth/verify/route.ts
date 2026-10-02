import { NextResponse, type NextRequest } from 'next/server'
import { redeemSignInLink, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * The target of the emailed link. Redeems the token, sets the session cookie
 * and sends the person to the dashboard.
 *
 * A failure never says which of the three reasons it was in a way that helps
 * someone probing, but it does tell a real person what to do next.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/signin?problem=missing', request.url))
  }

  const result = await redeemSignInLink(token)

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/signin?problem=${result.reason}`, request.url))
  }

  const response = NextResponse.redirect(new URL('/', request.url))

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
