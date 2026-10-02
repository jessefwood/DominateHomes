import { Card, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { currentProject } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const project = await currentProject()
  const milestones = await prisma.milestone.findMany({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Timeline"
        title="How this year runs"
        intro="The dates that drive everything else. The one with a hard edge is December, because of how vendors price and when the factories close."
      />

      <ol className="relative space-y-4 border-l border-ink/12 pl-6">
        {milestones.map((milestone) => (
          <li key={milestone.id} className="relative">
            <span
              className={`absolute top-2 -left-[31px] size-2.5 rounded-full ring-4 ring-oyster ${
                milestone.isDeadline ? 'bg-clay' : 'bg-driftwood'
              }`}
            />
            <Card className={`p-5 ${milestone.isDeadline ? 'border-clay/30 bg-clay/5' : ''}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg text-ink">{milestone.label}</h2>
                {milestone.isDeadline ? <Pill tone="clay">Deadline</Pill> : null}
              </div>
              <p className="mt-0.5 text-sm tracking-wide text-driftwood uppercase">{milestone.dateLabel}</p>
              {milestone.detail ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-driftwood-deep">{milestone.detail}</p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>

      <Card className="p-5">
        <p className="text-xs tracking-widest text-driftwood uppercase">The thing to avoid</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-driftwood-deep">
          A sofa with a ten week lead time and nowhere to land. Either orders get staged against a confirmed
          completion date, or we budget a local receiving warehouse at $300 to $800 a month. City Furniture and
          Family Furniture will usually hold a paid order. Wayfair will not.
        </p>
      </Card>
    </div>
  )
}
