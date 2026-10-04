import { OpenItemOwner, OpenItemStatus, Role, type Project, type User } from '@prisma/client'
import { prisma } from './db'

/**
 * The things each side owes the other.
 *
 * These already drove the two numbers on the client's dashboard and the
 * answer boxes on her open items screen. What was missing was any way for
 * Davina to create one: every open item in the database came from the seed,
 * so "waiting on you" could only ever shrink. Asking a client a question
 * meant texting her, and then the answer lived in a phone.
 *
 * `askClient` is that missing half. An item created here lands on her
 * dashboard, is answered in writing, and the answer stays on the project.
 */

export class OpenItemError extends Error {}

const LIMITS = { title: 200, detail: 2000 }

export type AskInput = {
  title: string
  detail?: string | null
  /**
   * Set where the answer genuinely stops an order going out, like a window
   * measurement. It puts the item at the top of her list and marks it on the
   * dashboard, so it is worth keeping honest: mark everything and the mark
   * stops meaning anything.
   */
  blocksOrdering?: boolean
}

/** Puts a question to the client. Returns the item so the caller can link to it. */
export async function askClient(
  actor: User,
  project: Pick<Project, 'id'>,
  input: AskInput,
) {
  const title = input.title.trim().slice(0, LIMITS.title)
  if (!title) throw new OpenItemError('Put the question in first.')

  // Appended rather than inserted, so an existing list does not reshuffle
  // under somebody who is halfway through answering it.
  const last = await prisma.openItem.findFirst({
    where: { projectId: project.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  return prisma.openItem.create({
    data: {
      projectId: project.id,
      owner: OpenItemOwner.CLIENT,
      title,
      detail: input.detail?.trim().slice(0, LIMITS.detail) || null,
      blocksOrdering: input.blocksOrdering ?? false,
      order: (last?.order ?? 0) + 1,
      status: OpenItemStatus.OPEN,
    },
  })
}

/**
 * Closes one off.
 *
 * Used for a question that got answered in a phone call, or one that stopped
 * mattering. The row stays with its answer; only the status moves, so the
 * record of what was asked survives.
 */
export async function closeOpenItem(itemId: string, projectId: string): Promise<void> {
  const item = await prisma.openItem.findUnique({ where: { id: itemId } })
  if (!item || item.projectId !== projectId) throw new OpenItemError('No such item.')

  await prisma.openItem.update({
    where: { id: itemId },
    data: { status: OpenItemStatus.CLOSED },
  })
}

/** Reopens one that was closed too early. */
export async function reopenOpenItem(itemId: string, projectId: string): Promise<void> {
  const item = await prisma.openItem.findUnique({ where: { id: itemId } })
  if (!item || item.projectId !== projectId) throw new OpenItemError('No such item.')

  await prisma.openItem.update({ where: { id: itemId }, data: { status: OpenItemStatus.OPEN } })
}

export async function openItemsFor(projectId: string) {
  return prisma.openItem.findMany({
    where: { projectId },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
    include: { answeredBy: { select: { name: true } } },
  })
}

/**
 * The clients on a project who can actually get in.
 *
 * Used for anything that emails them. Deliberately filtered by
 * `signInEnabled`: a client who is not open yet gets a link that does nothing,
 * so emailing them "there is something waiting for you" is worse than saying
 * nothing at all. The account exists in the database long before she should be
 * let in, and that rule has to hold here too.
 */
export async function reachableClients(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      user: { role: Role.CLIENT, signInEnabled: true },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return members.map((member) => member.user)
}
