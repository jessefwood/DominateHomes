import Link from 'next/link'
import { Card, PageHeader, Photo, PhotoMissing, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Every project, for the design side. This is the way in to editing one.
 *
 * Deliberately separate from /portal, which is the same list read as a client
 * reads it. This one is about running the projects: how much is still to pick,
 * whether an address has turned up yet, and the door to the editor.
 */
export default async function AdminProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { rooms: true, openItems: true } },
    },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Projects"
        intro="Open one to change its details, add photographs, and edit the rooms and the options inside it."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} href={`/admin/projects/${project.slug}`}>
            {project.heroImageUrl ? (
              <Photo src={project.heroImageUrl} alt={project.displayName} aspect="aspect-[16/9]" className="rounded-none" />
            ) : (
              <PhotoMissing aspect="aspect-[16/9]" className="rounded-none border-0 border-b">
                No photo on this project yet
              </PhotoMissing>
            )}

            <div className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight text-ink">{project.displayName}</p>
                  <p className="mt-0.5 text-sm text-driftwood">{project.community}</p>
                </div>
                <Pill>{project.phase.toLowerCase()}</Pill>
              </div>

              <p className="mt-3 text-sm text-driftwood-deep">
                {project._count.rooms} rooms · {project._count.openItems} open items
              </p>

              {!project.addressLine ? (
                <p className="mt-2 text-sm leading-relaxed text-clay-deep">
                  No street address yet, so it goes by its plan name everywhere.
                </p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-driftwood">
        A project is created by seeding it from the source documents in{' '}
        <code className="font-mono text-xs">docs/</code>, not from this screen.{' '}
        <Link href="/admin" className="text-ink underline underline-offset-2">
          Overview
        </Link>{' '}
        has who can sign in.
      </p>
    </div>
  )
}
