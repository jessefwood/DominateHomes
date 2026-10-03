import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Role, type User } from '@prisma/client'
import { SESSION_COOKIE, userForSessionToken } from './auth'

/**
 * Reading who is signed in. Every screen goes through here.
 */

export async function currentUser(): Promise<User | null> {
  const jar = await cookies()
  return userForSessionToken(jar.get(SESSION_COOKIE)?.value)
}

/** For anything behind the portal. Sends a signed-out visitor to sign in. */
export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) redirect('/signin')
  return user
}

export async function requireDesigner(): Promise<User> {
  const user = await requireUser()
  if (user.role !== Role.DESIGNER) redirect('/portal')
  return user
}

// There is deliberately no currentProject() here any more. It returned
// whichever project happened to be first, which was fine when there was one
// and is a data leak when there is more than one. Screens resolve the project
// from the URL and check access: see requireProjectAccess in lib/projects.ts.

/**
 * The base URL sign-in links are built from. Must be set in production: a link
 * built from the wrong host is a link that does not work.
 */
export function appUrl(): string {
  const configured = process.env.APP_URL
  if (configured) return configured.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL must be set in production so sign-in links point at the right host.')
  }

  return 'http://localhost:3000'
}
