import Link from 'next/link'
import { Role } from '@prisma/client'
import { Card, PageHeader, Pill } from '@/components/ui'
import { pendingAccessRequestCount } from '@/lib/access-requests'
import { listIntegrations } from '@/lib/integrations'
import { prisma } from '@/lib/db'
import { dateAndTime } from '@/lib/dates'
import { trashCount } from '@/lib/trash'
import { UserRow } from './user-row'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const [projects, users, integrations, waiting, inTrash, recent] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { rooms: true } } },
    }),
    prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    listIntegrations(),
    pendingAccessRequestCount(),
    trashCount(),
    // Only the latest one is shown here. The whole log is /admin/activity.
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
  ])

  const connected = integrations.filter((entry) => entry.connected && entry.enabled).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        intro="Projects, who can sign in, and which services are connected."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/people"
          className="hairline rounded-xl border bg-page p-4 shadow-sheet transition-shadow hover:shadow-lifted"
        >
          <p className="text-xs tracking-widest text-driftwood uppercase">People</p>
          <p className="font-display mt-1 text-2xl text-ink">{waiting}</p>
          <p className="mt-0.5 text-sm text-driftwood">
            {waiting === 1 ? 'request waiting on you' : 'requests waiting on you'}
          </p>
        </Link>

        <Link
          href="/admin/activity"
          className="hairline rounded-xl border bg-page p-4 shadow-sheet transition-shadow hover:shadow-lifted"
        >
          <p className="text-xs tracking-widest text-driftwood uppercase">Activity</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {recent[0] ? recent[0].summary : 'Nothing recorded yet'}
          </p>
          <p className="mt-1 text-sm text-driftwood">
            {recent[0] ? dateAndTime(recent[0].createdAt) : 'Signing in and files show up here'}
          </p>
        </Link>

        <Link
          href="/admin/trash"
          className="hairline rounded-xl border bg-page p-4 shadow-sheet transition-shadow hover:shadow-lifted"
        >
          <p className="text-xs tracking-widest text-driftwood uppercase">Trash</p>
          <p className="font-display mt-1 text-2xl text-ink">{inTrash}</p>
          <p className="mt-0.5 text-sm text-driftwood">
            {inTrash === 1 ? 'thing removed, still here' : 'things removed, still here'}
          </p>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Projects</h2>
          <Link href="/admin/projects" className="text-sm text-driftwood hover:text-ink">
            Edit them
          </Link>
        </div>
        {projects.map((project) => (
          <Card key={project.id} href={`/admin/projects/${project.slug}`} className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-display text-lg text-ink">{project.displayName}</p>
                <p className="mt-0.5 text-sm text-driftwood">
                  {project.community} · {project._count.rooms} rooms
                </p>
              </div>
              <Pill>{project.phase.toLowerCase()}</Pill>
            </div>
            {!project.addressLine ? (
              <p className="mt-2 text-sm text-driftwood-deep">
                No street address assigned yet, so the project goes by its name everywhere.
              </p>
            ) : null}
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Who can sign in</h2>
          <Link href="/admin/integrations" className="text-sm text-driftwood hover:text-ink">
            Integrations ({connected} on)
          </Link>
        </div>

        <Card className="divide-y divide-ink/10">
          {users.map((user) => (
            <UserRow
              key={user.id}
              id={user.id}
              name={user.name}
              email={user.email}
              isDesigner={user.role === Role.DESIGNER}
              signInEnabled={user.signInEnabled}
            />
          ))}
        </Card>

        <p className="text-sm leading-relaxed text-driftwood">
          A client stays locked out until the proposal and the design services agreement exist. While they are
          locked out, asking for a sign-in link does nothing at all, even for someone holding the address, and
          any session they already had is ended. Letting someone in is a business decision, so it lives here
          rather than in the code.
        </p>
      </section>
    </div>
  )
}
