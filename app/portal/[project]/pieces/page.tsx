import { KeepStatus } from '@prisma/client'
import { Card, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatBand } from '@/lib/money'
import { requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function PiecesPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)
  const pieces = await prisma.reusePiece.findMany({
    where: { projectId: project.id },
    orderBy: [{ inventoryNo: 'asc' }, { name: 'asc' }],
    include: { destinationRoom: { select: { name: true } } },
  })

  const low = pieces.reduce((sum, p) => sum + (p.replacementLowCents ?? 0), 0)
  const high = pieces.reduce((sum, p) => sum + (p.replacementHighCents ?? 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your pieces"
        title="What you are bringing with you"
        intro="Everything coming from Colorado, where it lands, and what it would have cost to buy new instead. Change your mind here rather than over text, so we are both looking at the same list."
      />

      <Card className="p-5">
        <p className="text-sm leading-relaxed text-driftwood-deep">
          What you already own is doing about {formatBand(low, high)} of work in this house. That is the real
          frame for every keep or release decision. The question is not whether a piece is still nice, it is
          whether it is earning its wall.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {pieces.map((piece) => (
          <Card key={piece.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="leading-snug font-medium text-ink">{piece.name}</h2>
                <p className="mt-0.5 text-sm text-driftwood">
                  {piece.destinationRoom?.name ??
                    (piece.scenarioDependent ? 'Depends which plan we go with' : 'Not placed yet')}
                </p>
              </div>
              <Pill tone={piece.status === KeepStatus.KEEP ? 'sea' : 'neutral'}>
                {piece.status === KeepStatus.KEEP ? 'Keeping' : piece.status === KeepStatus.RELEASE ? 'Letting go' : 'Undecided'}
              </Pill>
            </div>

            {piece.description ? (
              <p className="mt-2 text-sm leading-relaxed text-driftwood-deep">{piece.description}</p>
            ) : null}

            {piece.dimensions ? (
              <p className="mt-2 text-sm text-driftwood">
                {piece.dimensions}
                {piece.measurementsConfirmed ? '' : '. Measured off a photo, so we should confirm it.'}
              </p>
            ) : null}

            {piece.treatmentNote ? (
              <p className="mt-2 text-sm leading-relaxed text-seaglass-deep">{piece.treatmentNote}</p>
            ) : null}

            {piece.replacementLowCents && piece.replacementHighCents ? (
              <p className="mt-3 text-sm text-driftwood">
                Buying this new would run {formatBand(piece.replacementLowCents, piece.replacementHighCents)}.
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}
