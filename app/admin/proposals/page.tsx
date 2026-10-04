import Link from 'next/link'
import { ProposalStatus } from '@prisma/client'
import { ProposalDocument } from '@/components/proposal-document'
import { EmptyState, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { proposalSides, TIER_LABEL } from '@/lib/proposals'
import { requireDesigner } from '@/lib/session'
import { ProposalControls } from './controls'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * Every proposal across every project, newest first, drafts included.
 *
 * A draft is shown in full rather than summarised, because the thing most
 * likely to go wrong is sending one that was never read, and a list of
 * reference numbers makes that easy to do.
 */
export default async function AdminProposals() {
  await requireDesigner()

  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      lines: { orderBy: { order: 'asc' } },
      payments: { orderBy: { order: 'asc' } },
      scope: { orderBy: { order: 'asc' } },
      project: { select: { slug: true, displayName: true } },
    },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Proposals"
        intro="The priced document the client signs. Furnishings come off the project's own room bands, so the proposal and the budget cannot disagree. The fee and your expenses are yours to set."
      />

      <Link
        href="/admin/proposals/new"
        className="inline-block rounded bg-ink px-4 py-2 text-sm text-oyster"
      >
        Draft a new one
      </Link>

      {proposals.length === 0 ? (
        <EmptyState>
          Nothing drafted yet. A proposal and a signed agreement are what gate a client being let
          into the portal, so this is the thing that unblocks Abbie.
        </EmptyState>
      ) : null}

      {proposals.map((proposal) => {
        const sides = proposalSides(proposal)
        return (
          <section key={proposal.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-ink">
                  {proposal.project.displayName} · {proposal.number}
                </h2>
                <p className="mt-0.5 text-sm text-driftwood">
                  {TIER_LABEL[proposal.tier]} · {formatCents(sides.goodsDeliveredCents)} goods,{' '}
                  {formatCents(sides.feesAndExpensesCents)} fee and expenses
                </p>
              </div>
              <Pill tone={proposal.status === ProposalStatus.ACCEPTED ? 'ink' : 'neutral'}>
                {proposal.status.toLowerCase()}
              </Pill>
            </div>

            <ProposalDocument proposal={proposal} />

            <ProposalControls
              proposalId={proposal.id}
              status={proposal.status}
              number={proposal.number}
            />

            <p className="text-sm text-driftwood">
              Her copy:{' '}
              <Link
                href={`/portal/${proposal.project.slug}/proposal`}
                className="text-ink underline underline-offset-2"
              >
                /portal/{proposal.project.slug}/proposal
              </Link>
            </p>
          </section>
        )
      })}
    </div>
  )
}
