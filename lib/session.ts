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
 * Hosts that mean "this machine", which is never where a client's browser is.
 *
 * Railway forwards to the container on localhost:8080, so that address is
 * both a plausible-looking thing to paste into a variable and completely
 * useless in an email.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export class AppUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppUrlError'
  }
}

/**
 * What is wrong with a configured base URL, or null when it is usable.
 *
 * Exported so admin can show the problem without trying to send anything.
 */
export function appUrlProblem(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value) return 'APP_URL is not set, so there is no address to build sign-in links from.'

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return `APP_URL is "${value}", which is not a web address. It should look like https://www.dominatehomes.com`
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `APP_URL is "${value}", which is not an http or https address.`
  }

  // The failure this whole function exists for. In production a loopback
  // address means every link emailed is dead on arrival: it points at the
  // recipient's own machine, where nothing is listening.
  if (process.env.NODE_ENV === 'production' && LOOPBACK.has(parsed.hostname)) {
    return `APP_URL is "${value}", which is this server talking to itself. Sign-in links built from it do not work on anybody else's device. Set it to the public address, https://www.dominatehomes.com`
  }

  return null
}

/**
 * The base URL sign-in links are built from.
 *
 * THIS IS CHECKED NOW, NOT TRUSTED. It used to return the variable verbatim,
 * and production had it set to `http://localhost:8080`, which is Railway's own
 * internal address. Every sign-in link the portal sent pointed at the
 * recipient's own phone, where nothing is listening, so every client got a
 * link that could not work and no error anywhere said why.
 *
 * That is the worst shape a failure can take: it looks like the client's
 * fault. They see a browser error, assume they did something wrong, and the
 * portal looks broken rather than misconfigured. Nothing in the logs
 * complained, because as far as the code was concerned it had done its job.
 *
 * So a bad value now stops the link being sent at all. Refusing to send is
 * worse for one person in the moment and much better overall: the person
 * asking gets a message telling them to text Davina, and admin says exactly
 * which variable is wrong and what to set it to. See appUrlProblem.
 */
export function appUrl(): string {
  const configured = process.env.APP_URL

  if (!configured && process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  const problem = appUrlProblem(configured)
  if (problem) throw new AppUrlError(problem)

  return configured!.trim().replace(/\/$/, '')
}
