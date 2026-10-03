import Link from 'next/link'
import { pendingAccessRequestCount } from '@/lib/access-requests'
import { AccountMenu } from '@/components/account-menu'
import { BackLink } from '@/components/back-link'
import { Logomark } from '@/components/logo'
import { AdminNav, type AdminLink } from '@/components/admin-nav'
import { appUrlProblem, requireDesigner } from '@/lib/session'

/**
 * Admin. Designers only: requireDesigner sends a client to their own portal
 * rather than showing a forbidden page, because a client has no business
 * knowing this area exists.
 */

const NAV: AdminLink[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/website', label: 'Website' },
  { href: '/admin/proposals', label: 'Proposals' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/trash', label: 'Trash' },
]

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDesigner()

  // On every admin page rather than only on People, because the cost of
  // missing one of these is losing a job to whoever replied first.
  const waiting = await pendingAccessRequestCount()

  // Shown on every admin page, above everything else, because while this is
  // wrong nobody can sign in at all. Production once had APP_URL set to
  // Railway's internal address, so every link emailed pointed at the
  // recipient's own phone, and nothing anywhere said so: the only symptom was
  // a client seeing a browser error and assuming they had done something
  // wrong. A misconfiguration that only a client can observe is one nobody
  // fixes.
  const linkProblem = appUrlProblem(process.env.APP_URL)

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
        {linkProblem ? (
          <div className="mb-6 rounded-lg border border-clay bg-clay-wash px-4 py-3.5">
            <p className="font-medium text-clay-deep">Nobody can sign in at the moment.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-clay-deep">{linkProblem}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-driftwood-deep">
              Change it in the Railway settings for this service, under Variables. Nothing is being
              emailed until it is right, which is deliberate: a link that cannot work looks to the
              client like their own fault.
            </p>
          </div>
        ) : null}

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
