'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type PortalSection = { segment: string; label: string }

/**
 * The section list down the side of a project.
 *
 * Client side only so the current page can mark itself. Ten links with nothing
 * indicating which one you are on is the main reason the portal felt like a
 * set of pages rather than one place.
 */
export function PortalNav({ slug, sections }: { slug: string; sections: PortalSection[] }) {
  const pathname = usePathname()
  const root = `/portal/${slug}`

  return (
    <nav className="flex flex-wrap gap-x-1 gap-y-0.5 lg:flex-col">
      {sections.map((item) => {
        const href = item.segment ? `${root}/${item.segment}` : root
        // The dashboard is the root, so it only matches exactly. Every other
        // section also owns everything under it, which is what keeps "Room by
        // room" lit while you are inside one room.
        const active = item.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === root

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-oyster font-medium text-ink'
                : 'text-driftwood-deep hover:bg-oyster/60 hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
