'use server'

import { revalidatePath } from 'next/cache'
import { ProposalStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireProjectAccess } from '@/lib/projects'
import { acceptProposal, declineProposal } from '@/lib/proposals'
import { requireUser } from '@/lib/session'

/**
 * Accepting a proposal is the single most consequential thing a client does in
 * this portal, so the guard is explicit rather than inherited from the layout:
 * the proposal has to belong to a project this person may see, and it has to
 * be one that was actually sent.
 */
async function reachable(proposalId: string, projectSlug: string) {
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } })

  if (!proposal || proposal.projectId !== project.id) {
    throw new Error('That proposal is not on this project.')
  }

  // A draft has placeholder figures in it and is not hers to act on.
  if (proposal.status === ProposalStatus.DRAFT) {
    throw new Error('That proposal has not been issued yet.')
  }

  return { user, proposal }
}

export async function acceptProposalAction(
  proposalId: string,
  typedName: string,
  projectSlug: string,
): Promise<{ error?: string; ok?: true }> {
  const { user } = await reachable(proposalId, projectSlug)

  try {
    await acceptProposal({ proposalId, userId: user.id, typedName })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not go through.' }
  }

  revalidatePath(`/portal/${projectSlug}/proposal`)
  revalidatePath(`/portal/${projectSlug}`)
  return { ok: true as const }
}

export async function declineProposalAction(
  proposalId: string,
  note: string,
  projectSlug: string,
): Promise<{ error?: string; ok?: true }> {
  await reachable(proposalId, projectSlug)

  try {
    await declineProposal(proposalId, note)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That did not go through.' }
  }

  revalidatePath(`/portal/${projectSlug}/proposal`)
  return { ok: true as const }
}
