import { type NextRequest } from 'next/server'
import { destroySession, SESSION_COOKIE } from '@/lib/auth'
import { redirectTo } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  await destroySession(request.cookies.get(SESSION_COOKIE)?.value)

  const response = redirectTo('/signin')
  response.cookies.delete(SESSION_COOKIE)
  return response
}
