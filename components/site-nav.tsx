import Link from 'next/link'
import { Logomark } from '@/components/logo'

const LINKS = [
  { href: '/#work', label: 'How it works' },
  { href: '/#team', label: 'Who we are' },
  { href: '/#contact', label: 'Get in touch' },
]

export function SiteNav() {
  return (
    <header className="hairline border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5 sm:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Logomark className="w-9 shrink-0 text-ink" title="Dominate Homes" />
          <span>
            <span className="font-display block text-xl leading-none text-ink">Dominate Homes</span>
            <span className="mt-1 block text-[11px] tracking-[0.2em] text-driftwood uppercase">
              Furnishing &amp; Styling
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-9 sm:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-driftwood-deep transition-colors hover:text-ink">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-driftwood sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="flex items-center gap-2.5">
          <Logomark className="w-6 shrink-0 text-driftwood" />
          Dominate Homes. Chesapeake, Virginia.
        </p>
        <Link href="/signin" className="text-driftwood-deep hover:text-ink">
          Client login
        </Link>
      </div>
    </footer>
  )
}
