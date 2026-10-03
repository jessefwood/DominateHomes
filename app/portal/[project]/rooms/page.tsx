import { ApprovalStatus, RoomTier, SelectionStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatBand, formatCents } from '@/lib/money'
import { requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const TIER_LABEL: Record<RoomTier, string> = {
  MAJOR: 'Major room',
  LIGHT: 'Light touch',
  EXCLUDED: 'Not in scope',
}

function dimensions(widthFt: number | null, lengthFt: number | null) {
  if (!widthFt || !lengthFt) return null
  return `${widthFt} by ${lengthFt} feet`
}

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const rooms = await prisma.room.findMany({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
    include: {
      selections: { select: { status: true } },
      _count: { select: { selections: true } },
    },
  })

  const inScope = rooms.filter((room) => room.tier !== RoomTier.EXCLUDED)
  const outOfScope = rooms.filter((room) => room.tier === RoomTier.EXCLUDED)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Room by room"
        title="Every room in the house"
        intro="This is the whole project laid out one room at a time. Open a room to see what goes in it, what it is budgeted at, and where the decisions stand. Nothing here is a quote yet. The numbers are planning bands built from real retail prices, and they get firmed up once each item is priced against a live product."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {inScope.map((room) => {
          const total = room._count.selections
          const decided = room.selections.filter((s) => s.status !== SelectionStatus.PENDING).length
          const size = dimensions(room.widthFt, room.lengthFt)

          return (
            <Card key={room.id} href={`/portal/${project.slug}/rooms/${room.slug}`} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg leading-tight text-ink">{room.name}</h2>
                  <p className="mt-0.5 text-sm text-driftwood">
                    {size ? `${size}. ` : ''}
                    {TIER_LABEL[room.tier]}
                  </p>
                </div>
                {room.approvalStatus === ApprovalStatus.APPROVED ? (
                  <Pill tone="sea">Approved</Pill>
                ) : room.unresolvedNote ? (
                  <Pill tone="clay">Open question</Pill>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-driftwood-deep">{room.contents}</p>

              <dl className="hairline mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm">
                <div>
                  <dt className="text-xs tracking-wide text-driftwood uppercase">Planned at</dt>
                  <dd className="mt-0.5 text-ink">{formatCents(room.budgetMidCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-driftwood uppercase">Rug</dt>
                  <dd className="mt-0.5 text-ink">{room.rugSize ?? 'None'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs tracking-wide text-driftwood uppercase">Range</dt>
                  <dd className="mt-0.5 text-driftwood-deep">
                    {formatBand(room.budgetLowCents, room.budgetHighCents)}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-sm text-driftwood">
                {total === 0
                  ? 'No item list yet'
                  : decided === total
                    ? `All ${total} items picked`
                    : `${decided} of ${total} items picked`}
              </p>
            </Card>
          )
        })}
      </div>

      {outOfScope.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-ink">Not in scope</h2>
          <EmptyState>
            {outOfScope.map((room) => (
              <p key={room.id}>
                <span className="font-medium text-ink">{room.name}.</span> {room.contents}
              </p>
            ))}
          </EmptyState>
        </section>
      ) : null}
    </div>
  )
}
