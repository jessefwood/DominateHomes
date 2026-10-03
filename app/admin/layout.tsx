import Link from 'next/link'
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
  { href: '/admin/proposals', label: 'Proposals' },
  { href: '/admin/integrations', label: 'Integrations' },
]

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDesigner()

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

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">{children}</main>
    </div>
  )
}
