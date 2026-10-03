'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logomark } from '@/components/logo'

/**
 * The public site's chrome.
 *
 * Sticky and translucent, with the rule under it only appearing once the page
 * has moved. At the very top the bar should feel like part of the photograph
 * rather than a strip bolted above it, and a hairline sitting across a hero
 * image is the thing that makes a site look assembled rather than designed.
 *
 * The structure is lifted from the record label site, which Jesse asked for:
 * a bar that stays, a proper menu on a phone instead of three links squeezed
 * into a row, and anchors to the sections rather than separate pages. The
 * colours are not lifted. That site is dark with a red accent; this one is the
 * warm neutral palette the portal already uses.
 */

const LINKS = [
  { href: '/#work', label: 'Our work' },
  { href: '/#how', label: 'How it works' },
  { href: '/#team', label: 'Who we are' },
  { href: '/#contact', label: 'Get in touch' },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    const onScroll = () => setMoved(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A menu that stays open while the page scrolls underneath it reads as a
  // bug. Closing on resize matters too: opening the menu on a phone, rotating,
  // and finding a panel floating over a desktop layout is the same bug.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [open])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        moved || open ? 'hairline border-b bg-page/90 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-10 sm:py-5">
        <Link href="/" className="flex shrink-0 items-center gap-3" onClick={() => setOpen(false)}>
          <Logomark className="w-9 shrink-0 text-ink" title="Dominate Homes" />
          <span>
            <span className="font-display block text-xl leading-none text-ink">Dominate Homes</span>
            <span className="mt-1 block text-[11px] tracking-[0.2em] text-driftwood uppercase">
              Furnishing &amp; Styling
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-driftwood-deep transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/signin"
            className="hidden rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 sm:inline-block"
          >
            Client login
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            className="hairline rounded-md border p-2 text-ink lg:hidden"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M3 6h14" strokeLinecap="round" />
                  <path d="M3 10h14" strokeLinecap="round" />
                  <path d="M3 14h14" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <nav className="hairline border-t bg-page lg:hidden">
          <div className="mx-auto max-w-6xl px-6 py-3 sm:px-10">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="hairline block border-b py-3 text-[15px] text-driftwood-deep last:border-b-0 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signin"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-md bg-ink px-4 py-2.5 text-center text-[15px] text-page sm:hidden"
            >
              Client login
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="hairline mt-24 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-12 text-sm text-driftwood sm:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5">
            <Logomark className="w-6 shrink-0 text-driftwood" />
            Dominate Homes. Chesapeake, Virginia.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href="mailto:info@dominatehomes.com"
              className="text-driftwood-deep transition-colors hover:text-ink"
            >
              info@dominatehomes.com
            </a>
            <Link href="/request-access" className="text-driftwood-deep hover:text-ink">
              Ask for access
            </Link>
            <Link href="/signin" className="text-driftwood-deep hover:text-ink">
              Client login
            </Link>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-driftwood/80">
          Furnishing and styling new builds, room by room. Working with GL Homes and other builders.
        </p>
      </div>
    </footer>
  )
}
