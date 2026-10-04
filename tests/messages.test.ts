import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { Phase, Role } from '@prisma/client'
import {
  deleteMessage,
  markThreadRead,
  MAX_MESSAGE_LENGTH,
  messagesForProject,
  MessageError,
  postMessage,
  unreadCount,
} from '../lib/messages'
import { prisma, reset } from './helpers'

/**
 * The thread on a project.
 *
 * What is actually worth testing here is not the sending, it is the counting
 * and the scoping:
 *
 *   A message cannot be reached from another project. `deleteMessage` takes
 *   the project the caller has already been granted and checks the message
 *   against it, so a guessed id from somebody else's house does nothing.
 *
 *   The unread count never counts your own. Otherwise every message a client
 *   sends immediately shows her a badge about it.
 *
 *   Removing a message dates it. The row stays, the same as a file.
 */

async function people() {
  const suffix = randomBytes(4).toString('hex')

  const davina = await prisma.user.create({
    data: { email: `davina-${suffix}@example.invalid`, name: 'Davina Hughes', role: Role.DESIGNER },
  })
  const jesse = await prisma.user.create({
    data: { email: `jesse-${suffix}@example.invalid`, name: 'Jesse Wood', role: Role.DESIGNER },
  })
  const abbie = await prisma.user.create({
    data: { email: `abbie-${suffix}@example.invalid`, name: 'Abbie Tigges', role: Role.CLIENT },
  })

  const project = await prisma.project.create({
    data: {
      slug: `p-${suffix}`,
      displayName: '643 Bianca',
      community: 'Test',
      planName: 'Bianca',
      acSqFt: 2799,
      totalSqFt: 3599,
      phase: Phase.SELECTIONS,
      clientName: 'Abbie Tigges',
      designer: 'Davina Hughes',
      allocationCents: 4_700_000,
    },
  })

  await prisma.projectMember.create({ data: { projectId: project.id, userId: abbie.id } })

  return { davina, jesse, abbie, project }
}

describe('sending a message', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('keeps the text exactly as typed', async () => {
    const { abbie, project } = await people()

    // Line breaks matter and nothing else is interpreted. If this ever starts
    // being rendered as markup, this is the text that proves it.
    const body = 'Two things:\n\n1. <b>ceiling</b> is 14ft 6\n2. the rug is too small'
    await postMessage(abbie, project, body)

    const [message] = await messagesForProject(project.id)
    assert.equal(message.body, body)
  })

  it('trims, and refuses nothing at all', async () => {
    const { abbie, project } = await people()

    await assert.rejects(postMessage(abbie, project, '   \n  '), MessageError)
    assert.equal(await prisma.message.count(), 0)
  })

  it('refuses one that should have been a file', async () => {
    const { abbie, project } = await people()

    await assert.rejects(
      postMessage(abbie, project, 'x'.repeat(MAX_MESSAGE_LENGTH + 1)),
      MessageError,
    )
  })

  it('reads downwards, oldest first', async () => {
    const { abbie, davina, project } = await people()

    await postMessage(abbie, project, 'first')
    await postMessage(davina, project, 'second')
    await postMessage(abbie, project, 'third')

    const bodies = (await messagesForProject(project.id)).map((message) => message.body)
    assert.deepEqual(bodies, ['first', 'second', 'third'])
  })
})

describe('what counts as unread', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('never counts your own', async () => {
    const { abbie, project } = await people()
    await postMessage(abbie, project, 'hello')

    assert.equal(await unreadCount(abbie, project.id), 0)
  })

  it('counts the other side', async () => {
    const { abbie, davina, project } = await people()
    await postMessage(davina, project, 'hello')

    assert.equal(await unreadCount(abbie, project.id), 1)
    assert.equal(await unreadCount(davina, project.id), 0)
  })

  it('is one count per side, not per person', async () => {
    const { abbie, davina, jesse, project } = await people()
    await postMessage(abbie, project, 'hello')

    // Both designers see it waiting, and either of them reading it clears it
    // for both. With two of us on a project that is the useful behaviour: the
    // client wants to know whether anybody has read it.
    assert.equal(await unreadCount(davina, project.id), 1)
    assert.equal(await unreadCount(jesse, project.id), 1)

    await markThreadRead(davina, project.id)

    assert.equal(await unreadCount(davina, project.id), 0)
    assert.equal(await unreadCount(jesse, project.id), 0)
  })

  it('clears only the side that read it', async () => {
    const { abbie, davina, project } = await people()
    await postMessage(davina, project, 'from us')

    await markThreadRead(davina, project.id)
    assert.equal(await unreadCount(abbie, project.id), 1, 'the client’s count was cleared by us')

    await markThreadRead(abbie, project.id)
    assert.equal(await unreadCount(abbie, project.id), 0)
  })
})

describe('taking a message back', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('dates it rather than removing it', async () => {
    const { abbie, project } = await people()
    const message = await postMessage(abbie, project, 'said in haste')

    await deleteMessage(abbie, message.id, project.id)

    const row = await prisma.message.findUniqueOrThrow({ where: { id: message.id } })
    assert.notEqual(row.deletedAt, null)
    assert.equal(await prisma.message.count(), 1)
    // Gone from the thread, still in the database.
    assert.equal((await messagesForProject(project.id)).length, 0)
  })

  it('lets a designer remove anything on a project they run', async () => {
    const { abbie, davina, project } = await people()
    const message = await postMessage(abbie, project, 'from the client')

    await deleteMessage(davina, message.id, project.id)
    assert.equal((await messagesForProject(project.id)).length, 0)
  })

  it('will not let a client remove somebody else’s', async () => {
    const { abbie, davina, project } = await people()
    const message = await postMessage(davina, project, 'from us')

    await assert.rejects(deleteMessage(abbie, message.id, project.id), MessageError)

    const row = await prisma.message.findUniqueOrThrow({ where: { id: message.id } })
    assert.equal(row.deletedAt, null)
  })

  it('cannot be reached with an id from another project', async () => {
    const theirs = await people()
    const ours = await people()

    const message = await postMessage(theirs.abbie, theirs.project, 'their message')

    // The caller has been granted `ours.project`. A message id from another
    // house must do nothing, whoever is asking, designer included.
    await assert.rejects(deleteMessage(ours.davina, message.id, ours.project.id), MessageError)

    const row = await prisma.message.findUniqueOrThrow({ where: { id: message.id } })
    assert.equal(row.deletedAt, null)
  })
})
