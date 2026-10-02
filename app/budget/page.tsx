import { BudgetState, BudgetType } from '@prisma/client'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { BUDGET_TYPE_LABEL, budgetTotals, consumedCents, type SideTotals } from '@/lib/budget'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { currentProject } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Rule 2 on screen. Two columns side by side, each with its own planned,
 * committed, spent and remaining. There is deliberately no combined figure
 * anywhere on this page, because there is no combined figure in the data.
 */
function SideColumn({
  title, side, blurb,
}: {
  title: string
  side: SideTotals
  blurb: string
}) {
  const rows: [string, number][] = [
    ['Planned', side.plannedCents],
    ['Committed', side.committedCents],
    ['Spent', side.spentCents],
  ]

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-driftwood">{blurb}</p>

      <dl className="hairline mt-4 space-y-2 border-t pt-4">
        {rows.map(([label, cents]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-driftwood-deep">{label}</dt>
            <dd className="text-ink tabular-nums">{formatCents(cents)}</dd>
          </div>
        ))}
        <div className="hairline flex items-baseline justify-between gap-4 border-t pt-2">
          <dt className="text-sm font-medium text-ink">Left to spend</dt>
          <dd className="font-medium text-ink tabular-nums">{formatCents(side.remainingCents)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-driftwood">
        {formatCents(consumedCents(side))} of {formatCents(side.plannedCents)} used so far.
      </p>
    </Card>
  )
}

export default async function BudgetPage() {
  const project = await currentProject()

  const [totals, lines] = await Promise.all([
    budgetTotals(project.id),
    prisma.budgetLine.findMany({
      where: { projectId: project.id },
      orderBy: [{ type: 'asc' }, { amountCents: 'desc' }],
      include: { room: { select: { name: true } } },
    }),
  ])

  const byType = (type: BudgetType) => lines.filter((line) => line.type === type)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Budget"
        title="What this costs, in two separate piles"
        intro="The furnishings and Davina's expenses are tracked as two totals and they never get added together. Everything on this page is a planning band built from real retail prices, not a quote. Nothing becomes a real number until it is priced against a live product and you have signed off on it."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SideColumn
          title={BUDGET_TYPE_LABEL.FURNISHING}
          side={totals.furnishing}
          blurb="The goods themselves, plus freight, tax and contingency."
        />
        <SideColumn
          title={BUDGET_TYPE_LABEL.EXPENSE}
          side={totals.expense}
          blurb="Davina's own costs of running the project, kept entirely apart from the furniture."
        />
      </div>

      {[BudgetType.FURNISHING, BudgetType.EXPENSE].map((type) => {
        const rows = byType(type)
        return (
          <section key={type} className="space-y-3">
            <h2 className="font-display text-xl text-ink">{BUDGET_TYPE_LABEL[type]}</h2>

            {rows.length === 0 ? (
              <EmptyState>Nothing recorded on this side yet.</EmptyState>
            ) : rows.every((row) => row.amountCents === 0) ? (
              <>
                <EmptyState>
                  Nothing is costed on this side yet. The design services agreement and the pricing proposal both
                  need to exist first, and until they do there is no number to show you here.
                </EmptyState>
                <Card className="divide-y divide-ink/10">
                  {rows.map((line) => (
                    <div key={line.id} className="p-4">
                      <p className="font-medium text-ink">{line.label}</p>
                      {line.note ? (
                        <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">{line.note}</p>
                      ) : null}
                    </div>
                  ))}
                </Card>
              </>
            ) : (
              <Card className="divide-y divide-ink/10">
                {rows.map((line) => (
                  <div key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{line.label}</p>
                      <p className="mt-0.5 text-sm text-driftwood">
                        {line.room?.name ?? line.category ?? 'Whole house'}
                        {line.state !== BudgetState.PLANNED ? ` · ${line.state.toLowerCase()}` : ''}
                      </p>
                      {line.note ? (
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-driftwood-deep">{line.note}</p>
                      ) : null}
                    </div>
                    <p className="text-ink tabular-nums">{formatCents(line.amountCents)}</p>
                  </div>
                ))}
              </Card>
            )}
          </section>
        )
      })}
    </div>
  )
}
