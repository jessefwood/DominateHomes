import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import './globals.css'

/**
 * The title follows the project's name in the database rather than a string in
 * the code, so renaming a project is data and not a deploy. Falls back if the
 * database is unreachable, because /signin and /healthz still have to render.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const project = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
    if (project) {
      return { title: project.displayName, description: 'Your project with Dominate Homes.' }
    }
  } catch {
    // Fall through to the generic title.
  }
  return { title: 'Dominate Homes', description: 'Your project with Dominate Homes.' }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
