import { ApprovalStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { APPROVAL_STATEMENT } from '@/lib/approvals'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { currentProject } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const project = await currentProject()

  const approvals = await prisma.approval.findMany({
    where: { room: { projectId: project.id } },
    orderBy: { signedAt: 'desc' },
    include: { lines: true, room: { select: { name: true } } },
  })

  const ready = await prisma.room.count({
    where: { projectId: project.id, approvalStatus: ApprovalStatus.READY_FOR_APPROVAL },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Approvals"
        title="Signing off a room before anything is ordered"
        intro="Rooms get approved as a whole, so the pieces are signed off against each other rather than one at a time. Once you sign, the prices on that record are frozen exactly as they were on the day."
      />

      <Card className="p-5">
        <p className="text-xs tracking-widest text-driftwood uppercase">What you are agreeing to</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-driftwood-deep">{APPROVAL_STATEMENT}</p>
      </Card>

      {approvals.length === 0 ? (
        <EmptyState>
          Nothing has been signed off yet. {ready > 0
            ? `${ready} room${ready === 1 ? ' is' : 's are'} ready for you to look at.`
            : 'Rooms show up here once every item in them has a pick.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card key={approval.id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-ink">{approval.room.name}</h2>
                  <p className="mt-0.5 text-sm text-driftwood">
                    Signed by {approval.signedByName} on{' '}
                    {approval.signedAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                {approval.includedNonReturnable ? <Pill tone="clay">Includes non returnable items</Pill> : null}
              </div>

              <div className="hairline mt-4 divide-y divide-ink/10 border-t">
                {approval.lines.map((line) => (
                  <div key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {line.itemName}
                        {line.qty > 1 ? <span className="text-driftwood"> × {line.qty}</span> : null}
                      </p>
                      <p className="text-sm text-driftwood">
                        {line.optionLabel} · {line.vendor}
                        {line.nonReturnable ? ' · cannot be returned' : ''}
                      </p>
                    </div>
                    <p className="text-sm text-ink tabular-nums">{formatCents(line.lineTotalCents)}</p>
                  </div>
                ))}
              </div>

              <dl className="hairline mt-3 space-y-1 border-t pt-3">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-driftwood-deep">Furnishings, as priced that day</dt>
                  <dd className="text-ink tabular-nums">{formatCents(approval.furnishingTotalCents)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-driftwood-deep">Davina&rsquo;s expenses</dt>
                  <dd className="text-ink tabular-nums">{formatCents(approval.expenseTotalCents)}</dd>
                </div>
              </dl>

              <p className="mt-3 text-xs leading-relaxed text-driftwood">
                These figures are a snapshot taken when you signed. If a vendor price has moved since, this record
                does not move with it.
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
