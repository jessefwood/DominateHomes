import { OpenItemOwner, OpenItemStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import { AnswerBox } from './answer-box'

export const dynamic = 'force-dynamic'

export default async function OpenItemsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)
  const items = await prisma.openItem.findMany({
    where: { projectId: project.id },
    orderBy: [{ owner: 'asc' }, { order: 'asc' }],
  })

  const hers = items.filter((item) => item.owner === OpenItemOwner.CLIENT)
  const davinas = items.filter((item) => item.owner === OpenItemOwner.DESIGNER)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Open items"
        title="What each of us still owes the other"
        intro="Your list and Davina's list, side by side. Answer yours right here rather than digging back through texts."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Yours</h2>
            <Pill>{hers.filter((i) => i.status === OpenItemStatus.OPEN).length} open</Pill>
          </div>

          <div className="space-y-3">
            {hers.map((item) => (
              <Card key={item.id} id={`item-${item.id}`} className="scroll-mt-24 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">{item.title}</p>
                  {item.blocksOrdering && item.status === OpenItemStatus.OPEN ? (
                    <Pill tone="clay">Holds up ordering</Pill>
                  ) : null}
                </div>
                {item.detail ? (
                  <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">{item.detail}</p>
                ) : null}

                {item.status === OpenItemStatus.OPEN ? (
                  <AnswerBox itemId={item.id} projectSlug={project.slug} />
                ) : (
                  <div className="mt-3 rounded-md bg-seaglass-wash p-3 text-sm leading-relaxed text-driftwood-deep">
                    <p className="text-xs tracking-widest text-seaglass-deep uppercase">Your answer</p>
                    <p className="mt-1">{item.answer}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Davina&rsquo;s</h2>
            <Pill>{davinas.filter((i) => i.status === OpenItemStatus.OPEN).length} open</Pill>
          </div>

          {davinas.length === 0 ? (
            <EmptyState>Nothing outstanding.</EmptyState>
          ) : (
            <div className="space-y-3">
              {davinas.map((item) => (
                <Card key={item.id} id={`item-${item.id}`} className="scroll-mt-24 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-ink">{item.title}</p>
                    {item.status !== OpenItemStatus.OPEN ? <Pill tone="sea">Done</Pill> : null}
                  </div>
                  {item.detail ? (
                    <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">{item.detail}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
