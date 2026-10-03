import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { AuditAction, Role } from '@prisma/client'
import { record } from '../lib/audit'
import { redeemSignInLink, requestSignInLink } from '../lib/auth'
import { prisma, reset } from './helpers'

/**
 * The record of what happened.
 *
 * Two properties, and the first is the one that matters more than anything
 * the log actually contains:
 *
 *   RECORDING NEVER BREAKS THE THING IT IS RECORDING. An audit log that can
 *   take the portal down is a liability, not a safeguard. `record` swallows
 *   its own failures and reports them to the console.
 *
 *   THE SUMMARY IS FROZEN AT THE TIME. The screen shows the stored line as it
 *   was written. A log that re-renders itself from live data stops being a
 *   record of what happened and becomes a view of what is true now, which is
 *   exactly what it is not for.
 */

const BASE = 'https://portal.dominatehomes.com'

describe('writing an event', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('keeps who, what and which project', async () => {
    const user = await prisma.user.create({
      data: {
        email: `abbie-${randomBytes(4).toString('hex')}@example.invalid`,
        name: 'Abbie Tigges',
        role: Role.CLIENT,
      },
    })

    await record({
      action: AuditAction.SIGNED_IN,
      actor: user,
      summary: 'Abbie Tigges signed in',
      subjectType: 'User',
      subjectId: user.id,
    })

    const event = await prisma.auditEvent.findFirstOrThrow()
    assert.equal(event.action, AuditAction.SIGNED_IN)
    assert.equal(event.actorId, user.id)
    assert.equal(event.actorEmail, user.email)
    assert.equal(event.summary, 'Abbie Tigges signed in')
  })

  it('records something a signed-out visitor did, with no account to point at', async () => {
    await record({
      action: AuditAction.ACCESS_REQUESTED,
      actorEmail: 'stranger@example.invalid',
      summary: 'A Stranger (stranger@example.invalid) asked for access',
    })

    const event = await prisma.auditEvent.findFirstOrThrow()
    assert.equal(event.actorId, null)
    assert.equal(event.actorEmail, 'stranger@example.invalid')
  })

  it('does not throw when it cannot write', async () => {
    // A foreign key that cannot resolve stands in for any database failure.
    // The caller is in the middle of signing somebody in, and must not fail.
    await record({
      action: AuditAction.SIGNED_IN,
      actor: { id: 'does-not-exist', email: 'nobody@example.invalid' },
      summary: 'should not be written',
    })

    assert.equal(await prisma.auditEvent.count(), 0)
  })

  it('keeps the line it was given even after the name changes', async () => {
    const user = await prisma.user.create({
      data: {
        email: `davina-${randomBytes(4).toString('hex')}@example.invalid`,
        name: 'Davina Hughes',
        role: Role.DESIGNER,
      },
    })

    await record({
      action: AuditAction.ACCESS_OPENED,
      actor: user,
      summary: 'Davina Hughes opened access for Abbie Tigges',
    })

    await prisma.user.update({ where: { id: user.id }, data: { name: 'Davina Wood' } })

    const event = await prisma.auditEvent.findFirstOrThrow()
    assert.equal(event.summary, 'Davina Hughes opened access for Abbie Tigges')
  })
})

describe('signing in writes to the log', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('records the link going out and the sign-in itself', async () => {
    const user = await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie Tigges', role: Role.CLIENT },
    })

    const requested = await requestSignInLink(user.email, BASE)
    assert.equal(requested.sent, true)
    if (!requested.sent) return

    assert.equal(
      await prisma.auditEvent.count({ where: { action: AuditAction.SIGN_IN_REQUESTED } }),
      1,
    )

    const redeemed = await redeemSignInLink(requested.token)
    assert.equal(redeemed.ok, true)

    const signedIn = await prisma.auditEvent.findFirstOrThrow({
      where: { action: AuditAction.SIGNED_IN },
    })
    assert.equal(signedIn.actorId, user.id)
  })

  it('writes nothing for an address nobody has', async () => {
    await requestSignInLink('nobody@example.invalid', BASE)

    // Otherwise the log becomes a list of other people's email addresses,
    // collected by anybody who can reach the sign-in form.
    assert.equal(await prisma.auditEvent.count(), 0)
  })

  it('writes nothing for an account that is not open yet', async () => {
    await prisma.user.create({
      data: {
        email: 'abbie@example.invalid',
        name: 'Abbie Tigges',
        role: Role.CLIENT,
        signInEnabled: false,
      },
    })

    await requestSignInLink('abbie@example.invalid', BASE)
    assert.equal(await prisma.auditEvent.count(), 0)
  })

  it('does not record a sign-in for a token that did not work', async () => {
    const madeUp = randomBytes(32).toString('base64url')
    const result = await redeemSignInLink(madeUp)

    assert.equal(result.ok, false)
    assert.equal(await prisma.auditEvent.count({ where: { action: AuditAction.SIGNED_IN } }), 0)
    // And nothing was looked up by a hash that is not in the table.
    assert.equal(
      await prisma.loginToken.count({
        where: { tokenHash: createHash('sha256').update(madeUp).digest('hex') },
      }),
      0,
    )
  })
})
