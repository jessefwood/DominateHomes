import { Role } from '@prisma/client'
import { prisma } from './db'

/**
 * The same normalisation `lib/auth.ts` does, repeated here rather than
 * imported, because auth.ts imports this file and a cycle between the two
 * would be a cycle in the sign-in path. Two lines is a cheaper price than
 * that.
 */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * The designer list in the hosting settings, as a way back in.
 *
 * This repo already decides who is a designer with `User.role`, and that
 * stays the source of truth: it is what every access check reads, it is
 * editable in admin by the person whose decision it is, and moving it into an
 * environment variable would mean touching every one of those checks.
 *
 * What the database cannot do is let you back in when the database is the
 * problem. There is no self-signup here and no password reset, so if both
 * designer rows were closed by accident, or lost in a bad restore, the only
 * way in would be a psql session against production. `ADMIN_EMAILS` is the
 * way back in: an address on that list can always ask for a sign-in link, and
 * gets a designer account whether or not one exists.
 *
 * It is a safety net and not a permission system. It only ever adds, it is
 * read at sign-in rather than on every page, and the only people who can set
 * it are the two who own the Railway project.
 */

/** Addresses from ADMIN_EMAILS, normalised. Comma or whitespace separated. */
export function configuredAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return []

  return raw
    .split(/[,\s]+/)
    .map((entry) => normaliseEmail(entry))
    .filter((entry) => entry.includes('@'))
}

export function isConfiguredAdmin(email: string): boolean {
  return configuredAdminEmails().includes(normaliseEmail(email))
}

/**
 * Makes sure an address on the list has a designer account that can sign in.
 *
 * Called when a sign-in link is asked for, which is the one moment it matters
 * and the one moment it is cheap. Returns the user when there is one to use,
 * and null when the address is not on the list.
 *
 * It will promote an existing client row to designer if that address is on
 * the list, which is deliberate: the alternative is a confusing half state
 * where the person named as an owner of the project cannot see admin.
 */
export async function ensureConfiguredAdmin(rawEmail: string) {
  const email = normaliseEmail(rawEmail)
  if (!isConfiguredAdmin(email)) return null

  const existing = await prisma.user.findUnique({ where: { email } })

  if (!existing) {
    // The name is a placeholder they can change in admin. Guessing from the
    // address would produce something worse than obviously-a-placeholder.
    return prisma.user.create({
      data: { email, name: email.split('@')[0], role: Role.DESIGNER, signInEnabled: true },
    })
  }

  if (existing.role === Role.DESIGNER && existing.signInEnabled) return existing

  return prisma.user.update({
    where: { id: existing.id },
    data: { role: Role.DESIGNER, signInEnabled: true },
  })
}
