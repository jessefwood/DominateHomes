import { type NextRequest } from 'next/server'
import { AuditAction, record } from '@/lib/audit'
import { destroySession, SESSION_COOKIE, userForSessionToken } from '@/lib/auth'
import { sameOrigin } from '@/lib/csrf'
import { redirectTo } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Signing somebody out from another site is a nuisance rather than a
  // breach, but it is still not something anybody asked for.
  if (!sameOrigin(request)) {
    return new Response('Not allowed', { status: 403 })
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value

  // Read before the session goes, because afterwards there is nobody to name.
  const user = await userForSessionToken(token)

  await destroySession(token)

  if (user) {
    await record({
      action: AuditAction.SIGNED_OUT,
      actor: user,
      subjectType: 'User',
      subjectId: user.id,
      summary: `${user.name} signed out`,
    })
  }

  const response = redirectTo('/signin')
  response.cookies.delete(SESSION_COOKIE)
  return response
}
