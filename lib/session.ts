import { Role } from '@prisma/client'
import { prisma } from './db'

/**
 * PLACEHOLDER SESSION.
 *
 * The sign-in approach is still an open decision, so nothing here authenticates
 * anybody. It resolves the client user so the screens can be built and reviewed
 * against real data, and it is the single place that has to change once auth is
 * chosen: every screen reads the current user through `currentUser()`.
 *
 * This must not reach production. `assertAuthConfigured()` is wired into the
 * layout so a production build with no auth fails loudly rather than quietly
 * serving the client's budget to the open internet.
 */

export class AuthNotConfiguredError extends Error {
  constructor() {
    super(
      'No authentication is configured. lib/session.ts is still the placeholder. ' +
        'Choose and wire up a sign-in approach before deploying this anywhere public.',
    )
    this.name = 'AuthNotConfiguredError'
  }
}

export const AUTH_IS_PLACEHOLDER = true

export function assertAuthConfigured() {
  if (AUTH_IS_PLACEHOLDER && process.env.NODE_ENV === 'production' && process.env.ALLOW_PLACEHOLDER_AUTH !== 'yes') {
    throw new AuthNotConfiguredError()
  }
}

export async function currentUser() {
  assertAuthConfigured()
  const user = await prisma.user.findFirst({ where: { role: Role.CLIENT } })
  if (!user) throw new Error('No client user found. Run the seed.')
  return user
}

export async function currentProject() {
  const project = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!project) throw new Error('No project found. Run the seed.')
  return project
}
