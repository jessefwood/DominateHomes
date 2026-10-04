import { EmptyState, PageHeader } from '@/components/ui'
import { prisma } from '@/lib/db'
import { requireDesigner } from '@/lib/session'
import { NewProposalForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function NewProposal() {
  await requireDesigner()

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, displayName: true, clientName: true },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Draft a proposal"
        intro="The furnishing side is read off this project's rooms at the level you pick, so there is nothing to type for it. Everything below is the part no data can guess."
      />

      {projects.length === 0 ? (
        <EmptyState>There are no projects yet, so there is nothing to price.</EmptyState>
      ) : (
        <NewProposalForm projects={projects} />
      )}
    </div>
  )
}
