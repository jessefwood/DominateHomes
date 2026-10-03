import { ProposalStatus } from '@prisma/client'
import { ProposalDocument } from '@/components/proposal-document'
import { EmptyState, PageHeader } from '@/components/ui'
import { isDesigner, requireProjectAccess } from '@/lib/projects'
import { currentProposalFor, proposalsForProject } from '@/lib/proposals'
import { requireUser } from '@/lib/session'
import { AcceptProposal } from './accept'

export const dynamic = 'force-dynamic'

/**
 * The client's copy of the proposal.
 *
 * Only issued proposals reach this page. A draft has placeholder fees in it,
 * and showing one would be worse than showing nothing, so `proposalsForProject`
 * filters them out rather than this page remembering to.
 */
export default async function ProposalPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const proposal = await currentProposalFor(project.id)
  const history = await proposalsForProject(project.id, { includeDrafts: false })

  if (!proposal) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Proposal"
          title="Nothing to read yet"
          intro="Davina is still putting the numbers together. The moment it is ready it lands here, and you will get an email about it."
        />
        <EmptyState>
          A proposal covers the furnishings room by room, the design fee and expenses kept separate
          from them, and the payment schedule. You sign it here when you are happy with it.
        </EmptyState>
      </div>
    )
  }

  const nextPayment = proposal.payments[0] ?? null

  return (
    <div className="space-y-6">
      <ProposalDocument proposal={proposal} />

      {proposal.status === ProposalStatus.SENT && !isDesigner(user) ? (
        <AcceptProposal
          proposalId={proposal.id}
          projectSlug={projectSlug}
          payableNowCents={nextPayment?.amountCents ?? null}
          payableNowLabel={nextPayment?.whenLabel ?? null}
        />
      ) : null}

      {proposal.status === ProposalStatus.SENT && isDesigner(user) ? (
        <EmptyState>
          This is the client&rsquo;s copy. Accepting is hers to do, so the signature block is not
          shown to you.
        </EmptyState>
      ) : null}

      {history.length > 1 ? (
        <div>
          <p className="text-xs tracking-widest text-driftwood uppercase">Earlier versions</p>
          <ul className="mt-2 space-y-1">
            {history
              .filter((row) => row.id !== proposal.id)
              .map((row) => (
                <li key={row.id} className="text-sm text-driftwood-deep">
                  {row.number} · {row.status.toLowerCase()}
                  {row.declineNote ? ` · ${row.declineNote}` : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
