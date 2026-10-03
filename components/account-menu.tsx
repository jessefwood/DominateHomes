'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * The account menu in the top right: who you are, and the ways out.
 *
 * A menu rather than a row of links because sign out sat one careless click
 * from the navigation, and because on a phone the row wrapped into a second
 * line of small targets. Everything that leaves the current project lives
 * here, in one place, in the order people reach for it.
 *
 * Sign out stays a real form post to /api/auth/signout. It clears a cookie, so
 * it must not be a GET: a link prefetcher or a corporate scanner opening it
 * would sign people out on its own.
 */
export function AccountMenu({
  name,
  email,
  isDesigner,
}: {
  name: string
  email: string
  isDesigner: boolean
}) {
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

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const item =
    'block w-full px-4 py-2.5 text-left text-sm text-driftwood-deep transition-colors hover:bg-oyster hover:text-ink'

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="hairline flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 transition-colors hover:bg-oyster"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-page">
          {initials || '?'}
        </span>
        <span className="hidden max-w-32 truncate text-sm text-driftwood-deep sm:block">{name}</span>
        <svg viewBox="0 0 16 16" aria-hidden className="size-3 text-driftwood" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="hairline absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-page py-1.5 shadow-lifted"
        >
          <div className="hairline border-b px-4 pt-1 pb-2.5">
            <p className="text-sm text-ink">{name}</p>
            <p className="mt-0.5 truncate text-xs text-driftwood">{email}</p>
          </div>

          <Link href="/portal" className={item} onClick={() => setOpen(false)}>
            All your projects
          </Link>

          {isDesigner ? (
            <Link href="/admin" className={item} onClick={() => setOpen(false)}>
              Admin
            </Link>
          ) : null}

          <Link href="/" className={item} onClick={() => setOpen(false)}>
            Dominate Homes site
          </Link>

          <form action="/api/auth/signout" method="post" className="hairline mt-1.5 border-t pt-1.5">
            <button type="submit" className={item}>
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
