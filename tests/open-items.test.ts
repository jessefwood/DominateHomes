import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { OpenItemOwner, OpenItemStatus, Phase, Role } from '@prisma/client'
import {
  askClient,
  closeOpenItem,
  openItemsFor,
  OpenItemError,
  reachableClients,
  reopenOpenItem,
} from '../lib/open-items'
import { prisma, reset } from './helpers'

/**
 * Asking the client something.
 *
 * This was the missing half of a feature that already half existed. Open items
 * drove two numbers on the client's dashboard and had answer boxes on their
 * own screen, but nothing anywhere could create one, so every item in the
 * database came from the seed and "waiting on you" could only ever shrink.
 * Asking a question meant a text message, and the answer lived in a phone.
 *
 * The property worth protecting is in `reachableClients`: an email about a
 * question only goes to somebody who can actually sign in. A client exists in
 * the database long before they should be let in, and telling that person
 * there is something waiting for them, behind a link that does nothing, is
 * worse than saying nothing at all.
 */

async function setup() {
  const suffix = randomBytes(4).toString('hex')

  const davina = await prisma.user.create({
    data: { email: `davina-${suffix}@example.invalid`, name: 'Davina Hughes', role: Role.DESIGNER },
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
      acSqFt: 1,
      totalSqFt: 1,
      phase: Phase.SELECTIONS,
      clientName: 'Abbie Tigges',
      designer: 'Davina Hughes',
      allocationCents: 1,
    },
  })

  await prisma.projectMember.create({ data: { projectId: project.id, userId: abbie.id } })

  return { davina, abbie, project }
}

describe('asking the client a question', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('lands on their list, not ours', async () => {
    const { davina, project } = await setup()

    await askClient(davina, project, { title: 'What width are the great room windows?' })

    const [item] = await openItemsFor(project.id)
    assert.equal(item.owner, OpenItemOwner.CLIENT)
    assert.equal(item.status, OpenItemStatus.OPEN)
    assert.equal(item.title, 'What width are the great room windows?')
    assert.equal(item.blocksOrdering, false)
  })

  it('can be marked as holding up an order', async () => {
    const { davina, project } = await setup()

    await askClient(davina, project, { title: 'Window sizes', blocksOrdering: true })

    const [item] = await openItemsFor(project.id)
    assert.equal(item.blocksOrdering, true)
  })

  it('refuses an empty question', async () => {
    const { davina, project } = await setup()

    await assert.rejects(askClient(davina, project, { title: '   ' }), OpenItemError)
    assert.equal(await prisma.openItem.count(), 0)
  })

  it('caps what gets stored', async () => {
    const { davina, project } = await setup()

    await askClient(davina, project, { title: 'x'.repeat(900), detail: 'y'.repeat(9000) })

    const [item] = await openItemsFor(project.id)
    assert.ok(item.title.length <= 200)
    assert.ok((item.detail ?? '').length <= 2000)
  })

  it('appends rather than inserting, so an existing list does not reshuffle', async () => {
    const { davina, project } = await setup()

    await askClient(davina, project, { title: 'First' })
    await askClient(davina, project, { title: 'Second' })

    const titles = (await openItemsFor(project.id)).map((item) => item.title)
    assert.deepEqual(titles, ['First', 'Second'])
  })
})

describe('closing one off', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('keeps the row and only moves the status', async () => {
    const { davina, project } = await setup()
    const item = await askClient(davina, project, { title: 'Answered on the phone' })

    await closeOpenItem(item.id, project.id)

    const after = await prisma.openItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.equal(after.status, OpenItemStatus.CLOSED)
    // The question itself survives, so the record of what was asked is intact.
    assert.equal(after.title, 'Answered on the phone')
  })

  it('can be put back', async () => {
    const { davina, project } = await setup()
    const item = await askClient(davina, project, { title: 'Closed too early' })

    await closeOpenItem(item.id, project.id)
    await reopenOpenItem(item.id, project.id)

    const after = await prisma.openItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.equal(after.status, OpenItemStatus.OPEN)
  })

  it('cannot be reached with an id from another project', async () => {
    const theirs = await setup()
    const ours = await setup()

    const item = await askClient(theirs.davina, theirs.project, { title: 'Theirs' })

    await assert.rejects(closeOpenItem(item.id, ours.project.id), OpenItemError)

    const after = await prisma.openItem.findUniqueOrThrow({ where: { id: item.id } })
    assert.equal(after.status, OpenItemStatus.OPEN)
  })
})

describe('who gets emailed about it', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('is the client on the project', async () => {
    const { abbie, project } = await setup()

    const reachable = await reachableClients(project.id)
    assert.deepEqual(
      reachable.map((client) => client.id),
      [abbie.id],
    )
  })

  it('is nobody while their access has not been opened yet', async () => {
    const { abbie, project } = await setup()
    await prisma.user.update({ where: { id: abbie.id }, data: { signInEnabled: false } })

    // THE ONE THAT MATTERS. A client exists in the database long before they
    // should be let in. Emailing that person "there is a question waiting for
    // you", behind a link that does nothing, is worse than saying nothing.
    assert.deepEqual(await reachableClients(project.id), [])
  })

  it('is never a designer', async () => {
    const { davina, project } = await setup()
    await prisma.projectMember.create({ data: { projectId: project.id, userId: davina.id } })

    const reachable = await reachableClients(project.id)
    assert.ok(!reachable.some((client) => client.id === davina.id))
  })

  it('is not a client on somebody else’s project', async () => {
    const theirs = await setup()
    const ours = await setup()

    const reachable = await reachableClients(ours.project.id)
    assert.ok(!reachable.some((client) => client.id === theirs.abbie.id))
  })
})
