import { Role, type Project, type User } from '@prisma/client'
import { notFound } from 'next/navigation'
import { prisma } from './db'

/**
 * Who can see which project.
 *
 * One rule, in one place: a designer sees every project because they run all
 * of them, and a client sees only the projects they are a member of. Every
 * project-scoped screen goes through `requireProjectAccess`, so a client
 * guessing another client's URL gets a not found rather than a budget.
 */

export function isDesigner(user: User): boolean {
  return user.role === Role.DESIGNER
}

/** Projects this person may open, in a stable order. */
export async function projectsForUser(user: User): Promise<Project[]> {
  if (isDesigner(user)) {
    return prisma.project.findMany({ orderBy: { createdAt: 'asc' } })
  }

  return prisma.project.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Resolves a project by slug and checks this person may see it.
 *
 * A client asking for a project they are not on gets `notFound`, deliberately
 * the same response as a slug that does not exist. Saying "forbidden" would
 * confirm the project is real, which tells them something about another
 * client they should not learn from a URL.
 */
export async function requireProjectAccess(user: User, slug: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { slug } })

  if (!project) notFound()

  if (isDesigner(user)) return project

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  })

  if (!membership) notFound()

  return project
}

/**
 * How the client on a project is named, for telling a designer whose view they
 * are looking at.
 *
 * Every screen under /portal is written to the client in the second person.
 * Read by Davina those screens say "waiting on you" and "waiting on Davina" on
 * the same row, which reads as a bug rather than as someone else's view. The
 * copy is right and should not change, so the fix is to label the view.
 */
export async function clientLabelFor(projectId: string): Promise<string | null> {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, user: { role: Role.CLIENT } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } },
  })

  if (!member) return null

  return member.label ?? member.user.name
}

/** True when there is exactly one project to show, so a picker is pointless. */
export async function soleProjectFor(user: User): Promise<Project | null> {
  const projects = await projectsForUser(user)
  return projects.length === 1 ? projects[0] : null
}

/**
 * Guards a write.
 *
 * Multi-project changes the threat model: before, every signed-in person
 * belonged to the only project there was, so an action that took a record id
 * could not touch anything that was not theirs. Now it can. Every action that
 * writes has to prove the record it is about to change belongs to a project
 * this person may see, not just that they are signed in.
 */
export async function requireSelectionAccess(user: User, selectionId: string, slug: string) {
  const project = await requireProjectAccess(user, slug)

  const selection = await prisma.selection.findUnique({
    where: { id: selectionId },
    include: { room: { select: { projectId: true } } },
  })

  if (!selection || selection.room.projectId !== project.id) notFound()
  return { project, selection }
}

export async function requireRoomAccess(user: User, roomId: string, slug: string) {
  const project = await requireProjectAccess(user, slug)
  const room = await prisma.room.findUnique({ where: { id: roomId } })

  if (!room || room.projectId !== project.id) notFound()
  return { project, room }
}

export async function requireOpenItemAccess(user: User, itemId: string, slug: string) {
  const project = await requireProjectAccess(user, slug)
  const item = await prisma.openItem.findUnique({ where: { id: itemId } })

  if (!item || item.projectId !== project.id) notFound()
  return { project, item }
}
