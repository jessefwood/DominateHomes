import type { Metadata } from 'next'
import Link from 'next/link'
import { AUTH_IS_PLACEHOLDER } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plan 643 Bianca PSL',
  description: 'Your project with Dominate Homes.',
}

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/rooms', label: 'Room by room' },
  { href: '/budget', label: 'Budget' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/pieces', label: 'Your pieces' },
  { href: '/art', label: 'Art' },
  { href: '/open-items', label: 'Open items' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/orders', label: 'Order tracker' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {AUTH_IS_PLACEHOLDER ? (
          <div className="bg-clay px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
            Internal build. No sign-in is configured yet, so this is not ready to share with a client.
          </div>
        ) : null}

        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12 lg:px-8">
          <aside className="lg:w-56 lg:shrink-0">
            <Link href="/" className="block">
              <p className="font-display text-xl leading-tight text-ink">Plan 643 Bianca PSL</p>
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
          </aside>

          <main className="min-w-0 flex-1 pb-16">{children}</main>
        </div>
      </body>
    </html>
  )
}
