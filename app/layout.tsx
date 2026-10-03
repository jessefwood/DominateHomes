import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import './globals.css'

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
    'Interior design for new builds on the Treasure Coast. Every room costed, every piece measured, and every decision narrowed to three options.'

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
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
