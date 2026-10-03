import Link from 'next/link'
import { Role } from '@prisma/client'
import { Card, PageHeader, Pill } from '@/components/ui'
import { listIntegrations } from '@/lib/integrations'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const [projects, users, integrations] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { rooms: true } } },
    }),
    prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    listIntegrations(),
  ])

  const connected = integrations.filter((entry) => entry.connected && entry.enabled).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        intro="Projects, who can sign in, and which services are connected."
      />

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Projects</h2>
        {projects.map((project) => (
          <Card key={project.id} className="p-5">
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
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{user.name}</p>
                <p className="mt-0.5 text-sm text-driftwood">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={user.role === Role.DESIGNER ? 'ink' : 'neutral'}>
                  {user.role === Role.DESIGNER ? 'Admin' : 'Client'}
                </Pill>
                <Pill tone={user.signInEnabled ? 'sea' : 'clay'}>
                  {user.signInEnabled ? 'Can sign in' : 'Locked out'}
                </Pill>
              </div>
            </div>
          ))}
        </Card>

        <p className="text-sm leading-relaxed text-driftwood">
          A client stays locked out until the proposal and the design services agreement exist. While they are
          locked out, asking for a sign-in link does nothing at all, even for someone holding the address.
        </p>
      </section>
    </div>
  )
}
