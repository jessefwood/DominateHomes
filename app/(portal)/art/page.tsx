import { ArtDecision, ReframeStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { currentProject } from '@/lib/session'

export const dynamic = 'force-dynamic'

const REFRAME_COPY: Record<ReframeStatus, string | null> = {
  NOT_NEEDED: null,
  APPROVED_TO_REFRAME: 'Reframing, to black or natural wood',
  AT_FRAMER: 'At the framer now',
  DONE: 'Reframed',
}

export default async function ArtPage() {
  const project = await currentProject()
  const pieces = await prisma.artPiece.findMany({
    where: { projectId: project.id },
    orderBy: [{ decision: 'asc' }, { title: 'asc' }],
    include: { destinationRoom: { select: { name: true } } },
  })

  const keeping = pieces.filter((p) => p.decision === ArtDecision.IN)
  const letting = pieces.filter((p) => p.decision === ArtDecision.OUT)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Art"
        title="The pieces and where they land"
        intro="What is coming, what size it is, and which of them we are reframing. Two frame finishes across the house, black and natural wood, with the Peter Lik panoramas keeping the steel they already have."
      />

      <Card className="p-5">
        <p className="text-xs tracking-widest text-driftwood uppercase">How we hang it</p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-driftwood-deep">
          <li>Centre line sits 57 to 60 inches off the floor on an open wall. That never changes with ceiling height.</li>
          <li>Ten foot ceilings lie to you. Push art above about 63 inches to centre and it floats. Fill the height with a tall plant or a lamp instead.</li>
          <li>Over furniture, leave 6 to 10 inches of air between the bottom of the frame and the sofa back or console top.</li>
          <li>A piece or a group spans about two thirds the width of whatever sits below it.</li>
          <li>Groups hang as one rectangle. Lay it out on the floor first and centre the whole outline.</li>
        </ul>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Coming with you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {keeping.map((piece) => (
            <Card key={piece.id} className="p-5">
              <h3 className="leading-snug font-medium text-ink">{piece.title}</h3>
              {piece.artist ? <p className="mt-0.5 text-sm text-driftwood">{piece.artist}</p> : null}
              {piece.sizeLabel ? (
                <p className="mt-2 text-sm text-driftwood-deep">
                  {piece.sizeLabel}
                  {piece.sizeConfirmed ? '' : '. Taken off a photo, so we need the real framed size.'}
                </p>
              ) : (
                <p className="mt-2 text-sm text-driftwood-deep">Size still to measure.</p>
              )}
              {piece.wallNote ? (
                <p className="mt-2 text-sm leading-relaxed text-driftwood-deep">{piece.wallNote}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {piece.destinationRoom ? <Pill>{piece.destinationRoom.name}</Pill> : <Pill>Wall not chosen</Pill>}
                {REFRAME_COPY[piece.reframeStatus] ? (
                  <Pill tone="sea">{REFRAME_COPY[piece.reframeStatus]}</Pill>
                ) : null}
                {piece.needsStudsOrCleat ? <Pill tone="clay">Needs studs or a cleat</Pill> : null}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Not coming</h2>
        {letting.length === 0 ? (
          <EmptyState>Nothing on this list.</EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {letting.map((piece) => (
              <p key={piece.id} className="p-4 text-driftwood-deep">{piece.title}</p>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
