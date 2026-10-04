'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export type SwitchableProject = {
  slug: string
  displayName: string
  community: string
}

/**
 * The project name in the top bar, which opens the other projects when there
 * are any.
 *
 * With one project it is deliberately not a menu, just the name, because a
 * control that opens a list of one is a small lie about how much there is.
 * Davina has every project and needs to move between them without going back
 * out to a list first; a client with one house should never know the control
 * exists.
 */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: SwitchableProject
  projects: SwitchableProject[]
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

  if (projects.length <= 1) {
    return <span className="font-display truncate text-lg text-ink">{current.displayName}</span>
  }

  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="-mx-2 flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-oyster"
      >
        <span className="font-display truncate text-lg text-ink">{current.displayName}</span>
        <svg viewBox="0 0 16 16" aria-hidden className="size-3 shrink-0 text-driftwood" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="hairline absolute left-0 z-50 mt-2 max-h-96 w-72 overflow-y-auto rounded-xl border bg-page py-1.5 shadow-lifted"
        >
          {projects.map((project) => (
            <Link
              key={project.slug}
              href={`/portal/${project.slug}`}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 transition-colors hover:bg-oyster ${
                project.slug === current.slug ? 'bg-oyster/60' : ''
              }`}
            >
              <span className="block truncate text-sm text-ink">{project.displayName}</span>
              <span className="mt-0.5 block truncate text-xs text-driftwood">{project.community}</span>
            </Link>
          ))}

          <Link
            href="/portal"
            onClick={() => setOpen(false)}
            className="hairline mt-1.5 block border-t px-4 pt-3 pb-1.5 text-sm text-driftwood transition-colors hover:text-ink"
          >
            See them all
          </Link>
        </div>
      ) : null}
    </div>
  )
}
