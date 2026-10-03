'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type AdminLink = { href: string; label: string; exact?: boolean }

export function AdminNav({ links }: { links: AdminLink[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`)

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-oyster font-medium text-ink'
                : 'text-driftwood-deep hover:bg-oyster/60 hover:text-ink'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
