import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { Phase, Role } from '@prisma/client'
import { projectsForUser, requireProjectAccess } from '../lib/projects'
import { prisma, reset } from './helpers'

/**
 * Multi-project changed the threat model. Before, everyone signed in belonged
 * to the only project there was. Now a client could type another client's slug
 * into the address bar, and these are the tests that say they cannot.
 */
describe('who can see which project', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  async function makeProject(slug: string) {
    return prisma.project.create({
      data: {
        slug,
        displayName: slug,
        community: 'Test',
        planName: 'Test',
        acSqFt: 1,
        totalSqFt: 1,
        phase: Phase.SELECTIONS,
        clientName: 'Test',
        designer: 'Davina Hughes',
        allocationCents: 1,
      },
    })
  }

  async function makeUser(email: string, role: Role) {
    return prisma.user.create({ data: { email, name: email, role } })
  }

  it('shows a client only the projects they are a member of', async () => {
    const mine = await makeProject('my-house')
    await makeProject('someone-elses-house')
    const client = await makeUser('client@example.invalid', Role.CLIENT)
    await prisma.projectMember.create({ data: { projectId: mine.id, userId: client.id } })

    const visible = await projectsForUser(client)

    assert.deepEqual(
      visible.map((project) => project.slug),
      ['my-house'],
    )
  })

  it('refuses a client the project they are not on', async () => {
    await makeProject('my-house')
    const theirs = await makeProject('someone-elses-house')
    const client = await makeUser('client@example.invalid', Role.CLIENT)
    await prisma.projectMember.create({
      data: { projectId: (await prisma.project.findUniqueOrThrow({ where: { slug: 'my-house' } })).id, userId: client.id },
    })

    // notFound() throws, which is what Next turns into a 404 page. The point
    // is that it is the same answer as a slug that does not exist, so the URL
    // cannot be used to discover that another client's project is real.
    await assert.rejects(() => requireProjectAccess(client, theirs.slug))
  })

  it('gives the same answer for a project that does not exist', async () => {
    const client = await makeUser('client@example.invalid', Role.CLIENT)

    await assert.rejects(() => requireProjectAccess(client, 'no-such-project'))
  })

  it('lets a designer see every project without a membership row', async () => {
    await makeProject('one')
    await makeProject('two')
    const designer = await makeUser('davina@example.invalid', Role.DESIGNER)

    const visible = await projectsForUser(designer)

    assert.deepEqual(
      visible.map((project) => project.slug).sort(),
      ['one', 'two'],
    )
    assert.equal(await prisma.projectMember.count(), 0)
    assert.ok(await requireProjectAccess(designer, 'two'))
  })

  it('shows a client with no projects nothing at all', async () => {
    await makeProject('one')
    const client = await makeUser('newclient@example.invalid', Role.CLIENT)

    assert.deepEqual(await projectsForUser(client), [])
  })

  it('supports one client on two houses', async () => {
    const a = await makeProject('house-one')
    const b = await makeProject('house-two')
    const client = await makeUser('client@example.invalid', Role.CLIENT)
    await prisma.projectMember.create({ data: { projectId: a.id, userId: client.id } })
    await prisma.projectMember.create({ data: { projectId: b.id, userId: client.id } })

    assert.equal((await projectsForUser(client)).length, 2)
  })

  it('supports two people on one house', async () => {
    const house = await makeProject('shared-house')
    const abbie = await makeUser('abbie@example.invalid', Role.CLIENT)
    const russell = await makeUser('russell@example.invalid', Role.CLIENT)
    await prisma.projectMember.create({ data: { projectId: house.id, userId: abbie.id } })
    await prisma.projectMember.create({ data: { projectId: house.id, userId: russell.id } })

    assert.ok(await requireProjectAccess(abbie, 'shared-house'))
    assert.ok(await requireProjectAccess(russell, 'shared-house'))
  })
})
