import Link from 'next/link'
import { currentProject, requireUser } from '@/lib/session'

/**
 * Everything inside this route group is behind sign-in. `requireUser` redirects
 * a signed-out visitor, so no page in here needs to check for itself.
 *
 * /signin, /healthz and the auth routes sit outside the group on purpose.
 */

const NAV = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/rooms', label: 'Room by room' },
  { href: '/portal/budget', label: 'Budget' },
  { href: '/portal/approvals', label: 'Approvals' },
  { href: '/portal/pieces', label: 'Your pieces' },
  { href: '/portal/art', label: 'Art' },
  { href: '/portal/open-items', label: 'Open items' },
  { href: '/portal/timeline', label: 'Timeline' },
  { href: '/portal/orders', label: 'Order tracker' },
]

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, project] = await Promise.all([requireUser(), currentProject()])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12 lg:px-8">
      <aside className="lg:w-56 lg:shrink-0">
        <Link href="/portal" className="block">
          <p className="font-display text-xl leading-tight text-ink">{project.displayName}</p>
          <p className="mt-1 text-xs tracking-wide text-driftwood uppercase">Dominate Homes</p>
        </Link>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 lg:mt-8 lg:flex-col lg:gap-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="-mx-2 rounded px-2 py-1.5 text-sm text-driftwood-deep transition-colors hover:bg-sand/60 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hairline mt-8 border-t pt-4">
          <p className="text-sm text-ink">{user.name}</p>
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
