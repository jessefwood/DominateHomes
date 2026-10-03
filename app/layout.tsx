import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { prisma } from '@/lib/db'
import './globals.css'

/**
 * Typography.
 *
 * Fraunces for display. It is an old-style serif with real optical sizing, so
 * a 60px headline gets the high contrast and tight fit that reads editorial,
 * while the same face at 20px stays sturdy. Its quirk axes are turned down:
 * SOFT 0 and WONK 0 give the refined cut rather than the playful one, which
 * is the difference between looking crafted and looking novelty.
 *
 * Inter for everything else, deliberately quiet. On a site whose job is to
 * make rooms look good, the interface type should not be competing.
 *
 * Both are self-hosted by next/font at build time: no request to Google when
 * someone loads the page, and no flash of fallback text.
 */
const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-face',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const text = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-text-face',
})

/**
 * Where the site is served from. Link previews need absolute URLs, so the
 * metadata base has to be the real public address.
 */
function siteUrl(): URL {
  return new URL(process.env.APP_URL ?? 'https://dominatehomes.com')
}

/**
 * The title follows the project's name in the database rather than a string in
 * the code, so renaming a project is data and not a deploy. Falls back if the
 * database is unreachable, because /signin and /healthz still have to render.
 */
export async function generateMetadata(): Promise<Metadata> {
  const description =
    'Furnishing and styling new builds, room by room. Every room costed, every piece measured, and every decision narrowed to three options. Based in Chesapeake, Virginia.'

  const base: Metadata = {
    metadataBase: siteUrl(),
    title: {
      default: 'Dominate Homes',
      // Inner pages read as "Budget · Dominate Homes" rather than a bare word
      // when someone shares a link to one.
      template: '%s · Dominate Homes',
    },
    description,
    applicationName: 'Dominate Homes',
    openGraph: {
      type: 'website',
      siteName: 'Dominate Homes',
      title: 'Dominate Homes',
      description,
      locale: 'en_US',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Dominate Homes',
      description,
    },
    // The portal is private. Keeping it out of search results costs nothing
    // and avoids a client's budget turning up in a crawl.
    robots: { index: true, follow: true },
  }

  try {
    const project = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
    if (project) {
      return {
        ...base,
        title: { default: 'Dominate Homes', template: `%s · ${project.displayName}` },
      }
    }
  } catch {
    // The landing page and health check must render without a database.
  }

  return base
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
