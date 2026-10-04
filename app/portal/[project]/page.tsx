import Link from 'next/link'
import { OpenItemOwner, OpenItemStatus, SelectionStatus } from '@prisma/client'
import { Card, OpenQuestion, PageHeader, Photo, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { requireProjectAccess } from '@/lib/projects'
import { currentProposalFor } from '@/lib/proposals'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const PHASE_COPY: Record<string, string> = {
  DIRECTION: 'Settling the look',
  SELECTIONS: 'Choosing pieces',
  APPROVALS: 'Signing off rooms',
  ORDERING: 'Placing orders',
  DELIVERY: 'Goods on the way',
  INSTALL: 'Installing',
  COMPLETE: 'Done',
}

function daysUntil(date: Date | null) {
  if (!date) return null
  const ms = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const [openItems, selections, proposal, deadline, roomsInScope] = await Promise.all([
    prisma.openItem.findMany({
      where: { projectId: project.id, status: OpenItemStatus.OPEN },
      orderBy: { order: 'asc' },
    }),
    // Scoped through the room to this project. Without the where clause this
    // counted every selection in the database, which read as "50 of 50" by
    // luck while there was one project and would have been wrong the day
    // there were two.
    prisma.selection.groupBy({
      by: ['status'],
      where: { room: { projectId: project.id } },
      _count: true,
    }),
    currentProposalFor(project.id),
    prisma.milestone.findFirst({
      where: { projectId: project.id, isDeadline: true },
      orderBy: { order: 'asc' },
    }),
    // The intro used to say "13 rooms" as a literal, written when there were
    // 13. There are 14 now, so it was quietly wrong on the first screen the
    // client reads. Counted.
    prisma.room.count({ where: { projectId: project.id, tier: { not: 'EXCLUDED' } } }),
  ])

  const hers = openItems.filter((item) => item.owner === OpenItemOwner.CLIENT)

  // The dashboard previews five of these, and which five matters. Ordered by
  // position alone it showed the five oldest, so anything that actually held
  // up an order sat below the fold behind five long-running questions, and a
  // question asked this morning could be invisible on the screen it was asked
  // on. The ones that stop an order go first.
  const herTop = [...hers].sort((a, b) => Number(b.blocksOrdering) - Number(a.blocksOrdering))
  const davinas = openItems.filter((item) => item.owner === OpenItemOwner.DESIGNER)

  const totalItems = selections.reduce((sum, row) => sum + row._count, 0)
  const pending = selections.find((row) => row.status === SelectionStatus.PENDING)?._count ?? 0

  const toInstall = daysUntil(project.installAfterOn)
  const toDeadline = daysUntil(deadline?.occursOn ?? null)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Hi ${user.name.split(' ')[0]}`}
        title="Where the project stands"
        intro={`${project.displayName}. ${project.acSqFt.toLocaleString()} square feet under air, ${roomsInScope} rooms we are touching. Everything below is a link: open whichever one you want to get on with.`}
      />

      {project.heroImageUrl ? (
        <figure>
          <Photo
            src={project.heroImageUrl}
            alt={project.displayName}
            aspect="aspect-[21/9]"
          />
          {project.heroCaption ? (
            <figcaption className="mt-2 text-sm text-driftwood">{project.heroCaption}</figcaption>
          ) : null}
        </figure>
      ) : null}

      {/*
        Every one of these is a door now.
        A dashboard that states four numbers and lets you click none of them
        is a dashboard that generates text messages: you read "8 waiting on
        you", you cannot act on it, so you ask. Each card goes to the screen
        that answers the number it shows, and says so underneath, because a
        card that happens to be clickable is only useful to somebody who
        guesses it is.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card href={`/portal/${project.slug}/rooms`} className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Right now</p>
          <p className="font-display mt-2 text-2xl text-ink">{PHASE_COPY[project.phase]}</p>
          <p className="mt-1 text-sm text-driftwood">
            {pending} of {totalItems} items still to pick
          </p>
          <p className="mt-3 text-sm text-seaglass-deep">Go room by room</p>
        </Card>

        <Card href={`/portal/${project.slug}/open-items`} className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Waiting on you</p>
          <p className="font-display mt-2 text-2xl text-ink">{hers.length}</p>
          <p className="mt-1 text-sm text-driftwood">
            {hers.filter((item) => item.blocksOrdering).length} of them hold up ordering
          </p>
          <p className="mt-3 text-sm text-seaglass-deep">
            {hers.length > 0 ? 'Answer them' : 'Nothing to do'}
          </p>
        </Card>

        <Card href={`/portal/${project.slug}/open-items`} className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Waiting on Davina</p>
          <p className="font-display mt-2 text-2xl text-ink">{davinas.length}</p>
          <p className="mt-1 text-sm text-driftwood">
            {proposal ? 'Your pricing proposal is ready' : 'Including your pricing proposal'}
          </p>
          <p className="mt-3 text-sm text-seaglass-deep">See what we owe you</p>
        </Card>

        <Card href={`/portal/${project.slug}/timeline`} className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Until install</p>
          <p className="font-display mt-2 text-2xl text-ink">{toInstall ?? 'TBC'}</p>
          <p className="mt-1 text-sm text-driftwood">days, give or take a couple of weeks</p>
          <p className="mt-3 text-sm text-seaglass-deep">See the timeline</p>
        </Card>
      </div>

      {deadline && toDeadline !== null ? (
        <Card
          href={`/portal/${project.slug}/timeline`}
          className="border-seaglass bg-seaglass-wash p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg text-ink">{deadline.label}</p>
              <p className="mt-0.5 text-sm text-driftwood-deep">{deadline.dateLabel}</p>
            </div>
            <Pill tone="sea">{toDeadline} days</Pill>
          </div>
          {deadline.detail ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-driftwood-deep">{deadline.detail}</p>
          ) : null}
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">What we need from you</h2>
            <Link href={`/portal/${project.slug}/open-items`} className="text-sm text-driftwood hover:text-ink">
              All of it
            </Link>
          </div>
          {hers.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-driftwood-deep">
              Nothing at the moment. We will put anything we need from you here, and you will get an
              email when we do.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {herTop.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/portal/${project.slug}/open-items#item-${item.id}`}
                    className="flex items-start gap-2 text-sm leading-relaxed transition-colors hover:text-ink"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-driftwood" />
                    <span className="text-driftwood-deep">
                      {item.title}
                      {item.blocksOrdering ? (
                        <span className="ml-1.5 text-xs text-clay">holds up ordering</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Money, at a glance</h2>
            <Link
              href={`/portal/${project.slug}/${proposal ? 'proposal' : 'budget'}`}
              className="text-sm text-driftwood hover:text-ink"
            >
              {proposal ? 'The proposal' : 'Full budget'}
            </Link>
          </div>
          {/*
            Davina's rule, in her words: she always puts client pricing in
            herself so she knows it is right. The figure that used to sit here
            came off the planning bands in the source documents, not from her,
            so by her own test it does not belong on a screen the client reads.
            It is the proposal that carries numbers now, because a proposal is
            a figure she entered and sent deliberately.
          */}
          {proposal ? (
            <dl className="mt-3 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-driftwood-deep">Goods, delivered</dt>
                <dd className="text-ink">{formatCents(proposal.goodsDeliveredCents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-driftwood-deep">Davina&rsquo;s fee and expenses</dt>
                <dd className="text-ink">{formatCents(proposal.feesAndExpensesCents)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-driftwood-deep">
              Nothing to show here yet. Numbers appear once Davina sends you the proposal, so what
              you read is always a figure she set rather than one worked out from a planning band.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-driftwood">
            Furnishings and Davina&rsquo;s own costs are two separate totals that never get added
            together. Nothing is a quote until it is priced against a live product.
          </p>
        </Card>
      </section>

      <OpenQuestion>
        GL Homes still has not assigned a street address or a lot number, and we need one before anyone can
        schedule a delivery or measure for blinds. The great room TV wall is also unresolved.
      </OpenQuestion>
    </div>
  )
}
