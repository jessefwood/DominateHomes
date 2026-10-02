import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApprovalStatus, SelectionStatus, type SelectionOption } from '@prisma/client'
import { Card, EmptyState, OpenQuestion, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatBand, formatCents } from '@/lib/money'
import { OPTION_SLOTS, SELECTION_STATUS_LABEL } from '@/lib/selections'
import { currentProject } from '@/lib/session'

export const dynamic = 'force-dynamic'

function statusTone(status: SelectionStatus) {
  if (status === SelectionStatus.PENDING) return 'neutral' as const
  if (status === SelectionStatus.CHOSEN) return 'sea' as const
  return 'ink' as const
}

/**
 * The picker. Exactly three columns, always, because the data model has
 * exactly three slots. An empty slot renders as an empty slot rather than
 * collapsing, so the shape of the decision is the same on every item: at most
 * three things to compare, never a wall of choices.
 */
function OptionSlots({
  options,
  chosenSlot,
}: {
  options: SelectionOption[]
  chosenSlot: SelectionOption['slot'] | null
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {OPTION_SLOTS.map((slot) => {
        const option = options.find((candidate) => candidate.slot === slot)
        const chosen = chosenSlot === slot

        if (!option) {
          return (
            <div
              key={slot}
              className="hairline rounded-md border border-dashed bg-oyster-deep/40 p-3 text-sm text-driftwood"
            >
              <p className="text-xs tracking-widest text-driftwood uppercase">Option {slot}</p>
              <p className="mt-2 leading-relaxed">Davina is still putting this one together.</p>
            </div>
          )
        }

        return (
          <div
            key={slot}
            className={`rounded-md border p-3 text-sm ${
              chosen ? 'border-seaglass bg-seaglass-wash' : 'hairline border bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-widest text-driftwood uppercase">Option {slot}</p>
              {chosen ? <Pill tone="sea">Your pick</Pill> : null}
            </div>
            <p className="mt-2 leading-snug font-medium text-ink">{option.label}</p>
            <p className="mt-1 text-driftwood">{option.vendor}</p>
            <p className="mt-2 text-ink">{formatCents(option.priceCents)}</p>
            {option.leadTimeDays ? (
              <p className="mt-1 text-driftwood">About {option.leadTimeDays} days to arrive</p>
            ) : null}
            {option.dimensions ? <p className="mt-1 text-driftwood">{option.dimensions}</p> : null}
            {option.nonReturnable ? (
              <p className="mt-2 text-xs leading-relaxed text-clay">
                Made to order, so it cannot be returned once the vendor confirms it.
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await currentProject()

  const room = await prisma.room.findUnique({
    where: { projectId_slug: { projectId: project.id, slug } },
    include: {
      selections: {
        orderBy: { ref: 'asc' },
        include: { options: { orderBy: { slot: 'asc' } }, chosenOption: true },
      },
      reusePieces: true,
      artPieces: true,
    },
  })

  if (!room) notFound()

  const size = room.widthFt && room.lengthFt ? `${room.widthFt} by ${room.lengthFt} feet` : null
  const picked = room.selections.filter((s) => s.status !== SelectionStatus.PENDING).length

  return (
    <div className="space-y-8">
      <div>
        <Link href="/rooms" className="text-sm text-driftwood hover:text-ink">
          Back to all rooms
        </Link>
      </div>

      <PageHeader eyebrow={size ?? 'Room'} title={room.name} intro={room.contents} />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>{room.rugSize ? `Rug ${room.rugSize}` : 'No rug'}</Pill>
        <Pill>Planned at {formatCents(room.budgetMidCents)}</Pill>
        <Pill>{formatBand(room.budgetLowCents, room.budgetHighCents)} depending on tier</Pill>
        {room.approvalStatus === ApprovalStatus.APPROVED ? <Pill tone="sea">Approved</Pill> : null}
      </div>

      {room.unresolvedNote ? <OpenQuestion>{room.unresolvedNote}</OpenQuestion> : null}

      {room.constraintNote ? (
        <Card className="p-4">
          <p className="text-xs tracking-widest text-driftwood uppercase">Worth knowing</p>
          <p className="mt-2 text-sm leading-relaxed text-driftwood-deep">{room.constraintNote}</p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl text-ink">What goes in here</h2>
          <p className="text-sm text-driftwood">
            {room.selections.length === 0
              ? 'No items yet'
              : `${picked} of ${room.selections.length} picked`}
          </p>
        </div>

        {room.selections.length === 0 ? (
          <EmptyState>
            The item list for this room is not built out yet. It is coming with the rest of the selections.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {room.selections.map((selection) => (
              <Card key={selection.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="leading-snug font-medium text-ink">
                      {selection.name}
                      {selection.qty > 1 ? (
                        <span className="ml-2 text-sm font-normal text-driftwood">
                          {selection.qty} of them
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-0.5 text-sm text-driftwood">
                      {selection.category} · {selection.ref}
                    </p>
                  </div>
                  <Pill tone={statusTone(selection.status)}>
                    {SELECTION_STATUS_LABEL[selection.status]}
                  </Pill>
                </div>

                {selection.plannedLowCents && selection.plannedHighCents ? (
                  <p className="mt-2 text-sm text-driftwood-deep">
                    Budgeted at {formatBand(selection.plannedLowCents, selection.plannedHighCents)},
                    depending on how far up the range we go.
                  </p>
                ) : null}

                {selection.notes ? (
                  <p className="mt-2 text-sm leading-relaxed text-driftwood-deep">{selection.notes}</p>
                ) : null}

                <OptionSlots options={selection.options} chosenSlot={selection.chosenSlot} />
              </Card>
            ))}
          </div>
        )}
      </section>

      {room.reusePieces.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ink">Your own pieces in this room</h2>
          <Card className="divide-y divide-ink/10">
            {room.reusePieces.map((piece) => (
              <div key={piece.id} className="p-4">
                <p className="font-medium text-ink">{piece.name}</p>
                {piece.dimensions ? (
                  <p className="mt-0.5 text-sm text-driftwood">
                    {piece.dimensions}
                    {piece.measurementsConfirmed ? '' : '. Measured off a photo, still to confirm.'}
                  </p>
                ) : null}
                {piece.treatmentNote ? (
                  <p className="mt-1 text-sm text-driftwood-deep">{piece.treatmentNote}</p>
                ) : null}
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  )
}
