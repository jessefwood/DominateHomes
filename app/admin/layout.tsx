import Link from 'next/link'
import { Logomark } from '@/components/logo'
import { requireDesigner } from '@/lib/session'

/**
 * Admin. Designers only: requireDesigner sends a client to their own portal
 * rather than showing a forbidden page, because a client has no business
 * knowing this area exists.
 */

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/proposals', label: 'Proposals' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/portal', label: 'Client portal' },
]

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDesigner()

  return (
    <div className="min-h-screen">
      <header className="hairline border-b bg-white/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-start gap-2.5">
            <Logomark className="mt-1 w-7 shrink-0 text-ink" title="Dominate Homes" />
            <div>
            <Link href="/admin" className="font-display text-lg leading-none text-ink">
              Dominate Homes admin
            </Link>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-driftwood uppercase">
              {user.name}
            </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-4">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-driftwood-deep hover:text-ink">
                {item.label}
              </Link>
            ))}
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-sm text-driftwood hover:text-ink">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">{children}</main>
    </div>
  )
}
