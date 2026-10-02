import Link from 'next/link'
import { OpenItemOwner, OpenItemStatus, SelectionStatus } from '@prisma/client'
import { Card, OpenQuestion, PageHeader, Pill } from '@/components/ui'
import { budgetTotals } from '@/lib/budget'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { currentProject, requireUser } from '@/lib/session'

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

export default async function DashboardPage() {
  const [user, project] = await Promise.all([requireUser(), currentProject()])

  const [openItems, selections, totals, deadline] = await Promise.all([
    prisma.openItem.findMany({
      where: { projectId: project.id, status: OpenItemStatus.OPEN },
      orderBy: { order: 'asc' },
    }),
    prisma.selection.groupBy({ by: ['status'], _count: true }),
    budgetTotals(project.id),
    prisma.milestone.findFirst({
      where: { projectId: project.id, isDeadline: true },
      orderBy: { order: 'asc' },
    }),
  ])

  const hers = openItems.filter((item) => item.owner === OpenItemOwner.CLIENT)
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
        intro={`${project.displayName}. ${project.acSqFt.toLocaleString()} square feet under air, 13 rooms we are touching. The direction is approved and the scope is settled, so the work now is picking pieces room by room.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Right now</p>
          <p className="font-display mt-2 text-2xl text-ink">{PHASE_COPY[project.phase]}</p>
          <p className="mt-1 text-sm text-driftwood">
            {pending} of {totalItems} items still to pick
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Waiting on you</p>
          <p className="font-display mt-2 text-2xl text-ink">{hers.length}</p>
          <p className="mt-1 text-sm text-driftwood">
            {hers.filter((item) => item.blocksOrdering).length} of them hold up ordering
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Waiting on Davina</p>
          <p className="font-display mt-2 text-2xl text-ink">{davinas.length}</p>
          <p className="mt-1 text-sm text-driftwood">Including your pricing proposal</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs tracking-widest text-driftwood uppercase">Until install</p>
          <p className="font-display mt-2 text-2xl text-ink">{toInstall ?? 'TBC'}</p>
          <p className="mt-1 text-sm text-driftwood">days, give or take a couple of weeks</p>
        </Card>
      </div>

      {deadline && toDeadline !== null ? (
        <Card className="border-seaglass bg-seaglass-wash p-5">
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
            <Link href="/open-items" className="text-sm text-driftwood hover:text-ink">
              All of it
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {hers.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-driftwood" />
                <span className="text-driftwood-deep">
                  {item.title}
                  {item.blocksOrdering ? <span className="ml-1.5 text-xs text-clay">holds up ordering</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Money, at a glance</h2>
            <Link href="/budget" className="text-sm text-driftwood hover:text-ink">
              Full budget
            </Link>
          </div>
          <dl className="mt-3 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-driftwood-deep">Furnishings planned</dt>
              <dd className="text-ink">{formatCents(totals.furnishing.plannedCents)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-driftwood-deep">Davina&rsquo;s expenses</dt>
              <dd className="text-ink">{formatCents(totals.expense.plannedCents)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-driftwood">
            Two separate totals that never get added together. Nothing is a quote until it is priced against a
            live product.
          </p>
        </Card>
      </section>

      <OpenQuestion>
        The house still has no street address, so everything refers to it as Plan 643 Bianca PSL until GL assigns
        a lot number. The great room TV wall is also unresolved.
      </OpenQuestion>
    </div>
  )
}
