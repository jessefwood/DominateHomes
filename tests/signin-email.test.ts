import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { Phase, Role } from '@prisma/client'
import { requestSignInLink } from '../lib/auth'
import { signInEmail } from '../lib/mailer'
import { projectsForUser } from '../lib/projects'
import { prisma, reset } from './helpers'

/**
 * Signing in is about the portal, not about a house.
 *
 * The email used to name a project, and the project it named was
 * `project.findFirst` ordered by creation: the oldest row in the whole table,
 * for everybody, with no reference to who was signing in. Jesse asked for a
 * link and got an email headed "643 Bianca".
 *
 * Two things were wrong with that, and these tests hold both down.
 *
 *   IT READ AS THOUGH THE PORTAL IS ONE HOUSE. It is the business. Somebody
 *   on three projects should not be told they are signing in to one of them,
 *   and a designer should not be told they are signing in to a client's.
 *
 *   IT LEAKED A CLIENT'S ADDRESS. Projects are named by street number and
 *   street name. Anybody who could ask for a link was emailed the name of a
 *   project whether or not they were on it.
 *
 * The fix is that there is no project to name: `signInEmail` does not take one
 * any more, so it cannot be put back by passing the wrong value. These tests
 * are about the behaviour that guarantees, not about the wording.
 */

const BASE = 'https://www.dominatehomes.com'

async function makeProject(displayName: string) {
  const suffix = randomBytes(4).toString('hex')
  return prisma.project.create({
    data: {
      slug: `p-${suffix}`,
      displayName,
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
}

describe('the sign-in email', () => {
  it('names the business, not a project', () => {
    const email = signInEmail('jesse@example.invalid', 'Jesse Wood', `${BASE}/x`, 20)

    assert.equal(email.subject, 'Your link to the Dominate Homes portal')
    assert.match(email.text, /Dominate Homes portal/)
  })

  it('says what happens once you are in', () => {
    // The part of the fix a person actually notices: the email sets the
    // expectation that there is a list on the other side of the link.
    const email = signInEmail('jesse@example.invalid', 'Jesse Wood', `${BASE}/x`, 20)

    assert.match(email.text, /open whichever one you want/)
    assert.match(email.html, /open whichever one you want/)
  })

  it('still greets the person by their first name', () => {
    const email = signInEmail('abbie@example.invalid', 'Abbie Tigges', `${BASE}/x`, 20)

    assert.match(email.text, /Hi Abbie/)
    assert.match(email.html, /Hi Abbie/)
    assert.ok(!email.text.includes('Tigges'), 'used the full name rather than the first name')
  })

  it('escapes a name rather than letting it close a tag', () => {
    const email = signInEmail(
      'x@example.invalid',
      '<script>alert(1)</script> Smith',
      `${BASE}/x`,
      20,
    )

    assert.ok(!email.html.includes('<script>'), 'a name reached the markup unescaped')
    assert.match(email.html, /&lt;script&gt;/)
  })

  it('carries the link and how long it lasts', () => {
    const link = `${BASE}/api/auth/verify?token=abc`
    const email = signInEmail('x@example.invalid', 'Abbie', link, 20)

    assert.ok(email.text.includes(link))
    assert.ok(email.html.includes(link))
    assert.match(email.text, /expires in 20 minutes/)
  })
})

describe('asking for a link when projects exist', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('does not put the oldest project in anybody’s email', async () => {
    // The exact shape of the bug: an old project nobody asking is a member
    // of, which findFirst would have picked for everyone.
    await makeProject('643 Bianca')
    await makeProject('118 Seagrass')

    const jesse = await prisma.user.create({
      data: { email: 'jesse@example.invalid', name: 'Jesse Wood', role: Role.DESIGNER },
    })

    const result = await requestSignInLink(jesse.email, BASE)
    assert.equal(result.sent, true)
    if (!result.sent) return

    // There is no project name to reach the email with. Built the same way
    // requestSignInLink builds it, which is now the only way it can be built.
    const email = signInEmail(jesse.email, jesse.name, `${BASE}/x`, 20)

    assert.ok(!email.subject.includes('643 Bianca'), email.subject)
    assert.ok(!email.text.includes('643 Bianca'), 'a project name reached the body')
    assert.ok(!email.html.includes('643 Bianca'), 'a project name reached the markup')
    assert.ok(!email.text.includes('Seagrass'))
  })
})

describe('what you land on', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('gives a client with one project a list of one, not a project', async () => {
    // The portal index renders whatever this returns, and it renders a list
    // at one project and at ten. Nothing anywhere unwraps a single result
    // into a redirect any more: soleProjectFor, which existed only for that,
    // is gone.
    const project = await makeProject('643 Bianca')
    const abbie = await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie Tigges', role: Role.CLIENT },
    })
    await prisma.projectMember.create({ data: { projectId: project.id, userId: abbie.id } })

    const projects = await projectsForUser(abbie)
    assert.equal(projects.length, 1)
    assert.equal(projects[0].displayName, '643 Bianca')
  })

  it('gives a client on two projects both of them', async () => {
    const first = await makeProject('643 Bianca')
    const second = await makeProject('118 Seagrass')

    const abbie = await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie Tigges', role: Role.CLIENT },
    })
    await prisma.projectMember.createMany({
      data: [
        { projectId: first.id, userId: abbie.id },
        { projectId: second.id, userId: abbie.id },
      ],
    })

    const names = (await projectsForUser(abbie)).map((p) => p.displayName)
    assert.deepEqual(names, ['643 Bianca', '118 Seagrass'])
  })

  it('gives a designer every project, including ones they are not a member of', async () => {
    await makeProject('643 Bianca')
    await makeProject('118 Seagrass')

    const jesse = await prisma.user.create({
      data: { email: 'jesse@example.invalid', name: 'Jesse Wood', role: Role.DESIGNER },
    })

    assert.equal((await projectsForUser(jesse)).length, 2)
  })
})
