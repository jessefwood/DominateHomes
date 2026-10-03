import Link from 'next/link'
import { pendingAccessRequestCount } from '@/lib/access-requests'
import { AccountMenu } from '@/components/account-menu'
import { BackLink } from '@/components/back-link'
import { Logomark } from '@/components/logo'
import { AdminNav, type AdminLink } from '@/components/admin-nav'
import { requireDesigner } from '@/lib/session'

/**
 * Admin. Designers only: requireDesigner sends a client to their own portal
 * rather than showing a forbidden page, because a client has no business
 * knowing this area exists.
 */

const NAV: AdminLink[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/proposals', label: 'Proposals' },
  { href: '/admin/integrations', label: 'Integrations' },
]

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDesigner()

  // On every admin page rather than only on People, because the cost of
  // missing one of these is losing a job to whoever replied first.
  const waiting = await pendingAccessRequestCount()

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-40 border-b bg-page/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
            <Logomark className="w-7 shrink-0 text-ink" title="Dominate Homes" />
            <span className="hidden text-[11px] leading-tight tracking-[0.18em] text-driftwood uppercase sm:block">
              Dominate Homes
              <br />
              Admin
            </span>
          </Link>

          <span className="hairline hidden h-7 w-px shrink-0 border-l sm:block" aria-hidden />

          <div className="min-w-0 flex-1 overflow-x-auto">
            <AdminNav links={NAV} />
          </div>

          <BackLink fallbackHref="/admin" className="hidden sm:inline-flex" />

          <AccountMenu name={user.name} email={user.email} isDesigner />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {waiting > 0 ? (
          <Link
            href="/admin/people"
            className="mb-6 block rounded-lg bg-clay-wash px-4 py-3 text-sm text-clay-deep transition-opacity hover:opacity-80"
          >
            {waiting === 1
              ? 'Somebody has asked for access and is waiting on you.'
              : `${waiting} people have asked for access and are waiting on you.`}{' '}
            <span className="underline underline-offset-2">Have a look</span>
          </Link>
        ) : null}
        {children}
      </main>
    </div>
  )
}
