import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { AuditAction, Phase, Role } from '@prisma/client'
import { alreadyNotifiedRecently, NOTIFY_WINDOW_MINUTES } from '../lib/notify'
import { prisma, reset } from './helpers'

/**
 * The throttle on activity emails.
 *
 * A client uploading eleven photographs of a great room is one event, not
 * eleven, and eleven emails is how a notification becomes something you
 * switch off. There is no table of sent notifications: the audit log already
 * records every upload and message, so this asks it.
 *
 * That makes the ordering at the call sites load bearing, and it is the thing
 * that would break silently. Ask first, write the audit event, then send. Ask
 * after writing and the only event it ever finds is the one just written, so
 * nothing is sent, ever, and nobody notices until a client says she sent
 * photographs a fortnight ago.
 */

async function setup() {
  const suffix = randomBytes(4).toString('hex')

  const abbie = await prisma.user.create({
    data: { email: `abbie-${suffix}@example.invalid`, name: 'Abbie Tigges', role: Role.CLIENT },
  })
  const russell = await prisma.user.create({
    data: { email: `russell-${suffix}@example.invalid`, name: 'Russell', role: Role.CLIENT },
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

  const other = await prisma.project.create({
    data: {
      slug: `other-${suffix}`,
      displayName: 'Somewhere else',
      community: 'Test',
      planName: 'Test',
      acSqFt: 1,
      totalSqFt: 1,
      phase: Phase.SELECTIONS,
      clientName: 'Someone',
      designer: 'Davina Hughes',
      allocationCents: 1,
    },
  })

  return { abbie, russell, project, other }
}

async function logged(
  actorId: string,
  projectId: string,
  action: AuditAction,
  minutesAgo = 0,
) {
  await prisma.auditEvent.create({
    data: {
      action,
      actorId,
      projectId,
      summary: 'test',
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    },
  })
}

describe('one email per person per quarter of an hour', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('lets the first one through', async () => {
    const { abbie, project } = await setup()
    assert.equal(await alreadyNotifiedRecently(abbie.id, project.id), false)
  })

  it('holds the next one back', async () => {
    const { abbie, project } = await setup()
    await logged(abbie.id, project.id, AuditAction.FILE_UPLOADED)

    assert.equal(await alreadyNotifiedRecently(abbie.id, project.id), true)
  })

  it('counts a message and an upload as the same kind of noise', async () => {
    const { abbie, project } = await setup()
    await logged(abbie.id, project.id, AuditAction.MESSAGE_SENT)

    // Sending a message and then uploading a photograph about it is one
    // thing happening, so it is one email.
    assert.equal(await alreadyNotifiedRecently(abbie.id, project.id), true)
  })

  it('lets one through once the window has passed', async () => {
    const { abbie, project } = await setup()
    await logged(abbie.id, project.id, AuditAction.FILE_UPLOADED, NOTIFY_WINDOW_MINUTES + 1)

    assert.equal(await alreadyNotifiedRecently(abbie.id, project.id), false)
  })

  it('is per person, so a husband uploading is not held back by his wife', async () => {
    const { abbie, russell, project } = await setup()
    await logged(abbie.id, project.id, AuditAction.FILE_UPLOADED)

    assert.equal(await alreadyNotifiedRecently(russell.id, project.id), false)
  })

  it('is per project, so one house does not silence another', async () => {
    const { abbie, project, other } = await setup()
    await logged(abbie.id, project.id, AuditAction.FILE_UPLOADED)

    assert.equal(await alreadyNotifiedRecently(abbie.id, other.id), false)
  })

  it('is not silenced by the things that are not activity', async () => {
    const { abbie, project } = await setup()
    // Signing in is in the same log and must not stop the email about what
    // she then did.
    await logged(abbie.id, project.id, AuditAction.SIGNED_IN)

    assert.equal(await alreadyNotifiedRecently(abbie.id, project.id), false)
  })
})
