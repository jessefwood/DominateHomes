'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * The pancake menu, for the sections of whichever area you are in.
 *
 * On a phone the portal used to wrap twelve section links into a block of
 * small targets above every page, and admin pushed eight into a strip that
 * scrolled sideways with nothing to say so, which meant the last three were
 * invisible unless you happened to swipe the right part of the screen. Both
 * are a menu now, in the top bar, on the right.
 *
 * Right aligned on purpose, in two senses. The button sits at the right of the
 * bar next to the account menu, because that is the corner a thumb reaches on
 * a phone and because the two menus belong together. And the panel is pinned
 * to the right edge rather than the left, so it opens inside the screen
 * instead of running off it.
 *
 * Only ever shown on small screens. The portal keeps its sidebar and admin
 * keeps its row from `lg` up, where there is room for them and where seeing
 * every section at once is the better arrangement.
 *
 * Closes on an outside click, on Escape, and on choosing something. The last
 * one matters most: a menu still sitting open over the page you just asked
 * for reads as a broken link.
 */

export type MenuLink = {
  href: string
  label: string
  /** Matches this href exactly rather than owning everything beneath it. */
  exact?: boolean
  /** A waiting count, e.g. unread messages. Hidden at zero. */
  count?: number
}

export function NavMenu({
  links,
  label = 'Sections',
  className = '',
}: {
  links: MenuLink[]
  label?: string
  className?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = links.find((link) =>
    link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`),
  )

  // The total sits on the closed button, so a waiting message is visible
  // without opening anything. A menu that hides the one number you needed to
  // see is worse than the wrapped row it replaced.
  const waiting = links.reduce((sum, link) => sum + (link.count ?? 0), 0)

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Close the menu' : 'Open the menu'}
        className="hairline flex items-center gap-2 rounded-md border px-2.5 py-2 text-ink transition-colors hover:bg-oyster"
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
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

        <span className="max-w-28 truncate text-sm text-driftwood-deep">
          {current?.label ?? label}
        </span>

        {waiting > 0 && !open ? (
          <span className="rounded-full bg-clay-deep px-1.5 py-0.5 text-[11px] leading-none text-page">
            {waiting}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="hairline absolute right-0 z-50 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl border bg-page py-1.5 shadow-lifted"
        >
          {links.map((link) => {
            const active = link === current

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-oyster font-medium text-ink'
                    : 'text-driftwood-deep hover:bg-oyster/60 hover:text-ink'
                }`}
              >
                <span className="min-w-0 truncate">{link.label}</span>
                {link.count ? (
                  <span className="shrink-0 rounded-full bg-clay-deep px-1.5 py-0.5 text-[11px] leading-none text-page">
                    {link.count}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
