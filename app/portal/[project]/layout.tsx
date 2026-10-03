import Link from 'next/link'
import { projectsForUser, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

/**
 * Everything under /portal/[project] is behind sign-in and behind access to
 * that specific project. requireProjectAccess answers not found rather than
 * forbidden for a project the person is not on, so a guessed URL tells them
 * nothing about another client.
 *
 * /, /signin, /healthz and the auth routes sit outside this.
 */

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

const SECTIONS = [
  { segment: '', label: 'Dashboard' },
  { segment: 'rooms', label: 'Room by room' },
  { segment: 'budget', label: 'Budget' },
  { segment: 'approvals', label: 'Approvals' },
  { segment: 'pieces', label: 'Your pieces' },
  { segment: 'art', label: 'Art' },
  { segment: 'open-items', label: 'Open items' },
  { segment: 'timeline', label: 'Timeline' },
  { segment: 'orders', label: 'Order tracker' },
]

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ project: string }>
}) {
  const { project: slug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, slug)

  // Only worth offering a way back to the list if there is a list.
  const others = await projectsForUser(user)
  const hasMore = others.length > 1

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12 lg:px-8">
      <aside className="lg:w-56 lg:shrink-0">
        <Link href={`/portal/${project.slug}`} className="block">
          <p className="font-display text-xl leading-tight text-ink">{project.displayName}</p>
          <p className="mt-1 text-xs tracking-wide text-driftwood uppercase">Dominate Homes</p>
        </Link>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 lg:mt-8 lg:flex-col lg:gap-y-0.5">
          {SECTIONS.map((item) => {
            const href = item.segment
              ? `/portal/${project.slug}/${item.segment}`
              : `/portal/${project.slug}`
            return (
              <Link
                key={href}
                href={href}
                className="-mx-2 rounded px-2 py-1.5 text-sm text-driftwood-deep transition-colors hover:bg-sand/60 hover:text-ink"
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hairline mt-8 border-t pt-4">
          <p className="text-sm text-ink">{user.name}</p>

          {hasMore ? (
            <Link href="/portal" className="mt-1 block text-sm text-driftwood hover:text-ink">
              Your other projects
            </Link>
          ) : null}

          {user.role === 'DESIGNER' ? (
            <Link href="/admin" className="mt-1 block text-sm text-driftwood hover:text-ink">
              Admin
            </Link>
          ) : null}

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="mt-1 text-sm text-driftwood transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-16">{children}</main>
    </div>
  )
}
