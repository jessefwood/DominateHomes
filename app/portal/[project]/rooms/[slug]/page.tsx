import { notFound } from 'next/navigation'
import { ApprovalStatus, SelectionStatus } from '@prisma/client'
import { BackLink } from '@/components/back-link'
import { Card, EmptyState, OpenQuestion, PageHeader, Photo, PhotoMissing, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatBand, formatCents } from '@/lib/money'
import { SELECTION_STATUS_LABEL } from '@/lib/selections'
import { requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import { ApproveRoom } from './approve'
import { OptionPicker } from './picker'

export const dynamic = 'force-dynamic'

function statusTone(status: SelectionStatus) {
  if (status === SelectionStatus.PENDING) return 'neutral' as const
  if (status === SelectionStatus.CHOSEN) return 'sea' as const
  return 'ink' as const
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ project: string; slug: string }>
}) {
  const { project: projectSlug, slug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

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

  const approved = room.approvalStatus === ApprovalStatus.APPROVED

  // A room can be signed off once every item in it has a pick. Rooms are
  // approved as a whole so the pieces are judged against each other.
  const readyToApprove =
    !approved &&
    room.selections.length > 0 &&
    room.selections.every((selection) => selection.chosenOption !== null)

  const roomTotalCents = room.selections.reduce(
    (sum, selection) => sum + (selection.chosenOption?.priceCents ?? 0) * selection.qty,
    0,
  )

  const nonReturnableItems = room.selections
    .filter((selection) => selection.chosenOption?.nonReturnable)
    .map((selection) => selection.name)

  return (
    <div className="space-y-8">
      {/*
        This said `/portal/${project}/rooms`, interpolating the whole project
        record rather than its slug, so every room linked back to
        /portal/[object Object]/rooms and 404d. It is `project.slug`.
      */}
      <BackLink fallbackHref={`/portal/${project.slug}/rooms`} label="Back to all rooms" />

      <PageHeader eyebrow={size ?? 'Room'} title={room.name} intro={room.contents} />

      {room.photoUrl ? (
        <figure>
          <Photo src={room.photoUrl} alt={room.name} aspect="aspect-[21/9]" />
          {room.photoCaption ? (
            <figcaption className="mt-2 text-sm text-driftwood">{room.photoCaption}</figcaption>
          ) : null}
        </figure>
      ) : null}

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

                <OptionPicker
                  selectionId={selection.id}
                  projectSlug={project.slug}
                  roomSlug={room.slug}
                  options={selection.options.map((option) => ({
                    slot: option.slot,
                    label: option.label,
                    vendor: option.vendor,
                    priceCents: option.priceCents,
                    leadTimeDays: option.leadTimeDays,
                    dimensions: option.dimensions,
                    nonReturnable: option.nonReturnable,
                    photoUrl: option.photoUrl,
                    productUrl: option.productUrl,
                  }))}
                  chosenSlot={selection.chosenSlot}
                  locked={selection.status !== SelectionStatus.PENDING && selection.status !== SelectionStatus.CHOSEN}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {readyToApprove ? (
        <ApproveRoom
          roomId={room.id}
          roomName={room.name}
          projectSlug={project.slug}
          roomSlug={room.slug}
          totalCents={roomTotalCents}
          nonReturnableItems={nonReturnableItems}
        />
      ) : null}

      {room.artPieces.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ink">Art for this room</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {room.artPieces.map((piece) => (
              <Card key={piece.id}>
                {piece.photoUrl ? (
                  <Photo src={piece.photoUrl} alt={piece.title} className="rounded-none" />
                ) : (
                  <PhotoMissing className="rounded-none border-0 border-b" />
                )}
                <div className="p-4">
                  <p className="leading-snug font-medium text-ink">{piece.title}</p>
                  {piece.sizeLabel ? (
                    <p className="mt-0.5 text-sm text-driftwood">{piece.sizeLabel}</p>
                  ) : null}
                  {piece.artist ? (
                    <p className="mt-0.5 text-sm text-driftwood">{piece.artist}</p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

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
