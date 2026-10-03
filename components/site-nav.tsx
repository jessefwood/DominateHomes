import Link from 'next/link'

const LINKS = [
  { href: '/#work', label: 'How it works' },
  { href: '/#team', label: 'Who we are' },
  { href: '/#contact', label: 'Get in touch' },
]

export function SiteNav() {
  return (
    <header className="hairline border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="shrink-0">
          <p className="font-display text-lg leading-none text-ink">Dominate Homes</p>
          <p className="mt-1 text-[11px] tracking-[0.18em] text-driftwood uppercase">Interior Design</p>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-driftwood-deep hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/signin"
          className="shrink-0 rounded-md bg-ink px-4 py-2 text-sm text-oyster transition-opacity hover:opacity-90"
        >
          Client login
        </Link>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="hairline mt-20 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-driftwood sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Dominate Homes. Port St. Lucie and the Treasure Coast.</p>
        <Link href="/signin" className="text-driftwood-deep hover:text-ink">
          Client login
        </Link>
      </div>
    </footer>
  )
}
