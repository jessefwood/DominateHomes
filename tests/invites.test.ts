import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { AccessRequestStatus, Phase, Role } from '@prisma/client'
import {
  AccessRequestError,
  approveAccessRequest,
  declineAccessRequest,
  REQUEST_WINDOW_MINUTES,
  requestAccess,
} from '../lib/access-requests'
import { acceptInvite, INVITE_TTL_DAYS, InviteError, revokeInvite, sendInvite } from '../lib/invites'
import { userForSessionToken } from '../lib/auth'
import { prisma, reset } from './helpers'

/**
 * The two ways somebody gets an account, and the things neither of them is
 * allowed to do.
 *
 * THE ONE THAT MATTERS: an invitation cannot make a designer. The role is
 * written as a literal in `acceptInvite` and there is no argument anywhere in
 * the chain that changes it, which means an invitation that leaks, or one
 * created from an approved public request, still only ever produces a client.
 *
 * The rest is about there being no self-signup. The public form records a
 * message and grants nothing, and approving it sends an invitation rather
 * than creating an account, so an approval made by accident can be withdrawn
 * before anybody is in.
 */

const BASE = 'https://portal.dominatehomes.com'

async function designer(email = `davina-${randomBytes(4).toString('hex')}@example.invalid`) {
  return prisma.user.create({ data: { email, name: 'Davina Hughes', role: Role.DESIGNER } })
}

async function project(slug = `p-${randomBytes(4).toString('hex')}`) {
  return prisma.project.create({
    data: {
      slug,
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
}

/**
 * The token only exists inside the email, which tests cannot read. Rewriting
 * the stored hash is how a test gets hold of a usable one, and it exercises
 * exactly the lookup the real route does.
 */
async function tokenFor(inviteId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await prisma.invite.update({
    where: { id: inviteId },
    data: { tokenHash: createHash('sha256').update(token).digest('hex') },
  })
  return token
}

describe('inviting a client', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('writes an invitation holding only a hash of the link', async () => {
    const actor = await designer()
    const home = await project()

    const invite = await sendInvite(actor, BASE, {
      email: 'Abbie@Example.Invalid',
      name: 'Abbie Tigges',
      projectId: home.id,
      label: 'Abbie and Russell',
    })

    assert.equal(invite.email, 'abbie@example.invalid', 'the address was not normalised')
    assert.equal(invite.projectId, home.id)
    assert.equal(invite.label, 'Abbie and Russell')
    assert.match(invite.tokenHash, /^[0-9a-f]{64}$/)
    assert.ok(invite.expiresAt.getTime() > Date.now())
    assert.ok(invite.expiresAt.getTime() <= Date.now() + INVITE_TTL_DAYS * 86_400_000 + 1000)
  })

  it('refuses an address that already has an account', async () => {
    const actor = await designer()
    await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie Tigges', role: Role.CLIENT },
    })

    await assert.rejects(
      sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' }),
      InviteError,
    )
  })

  it('refuses a name or an address that is not one', async () => {
    const actor = await designer()

    await assert.rejects(sendInvite(actor, BASE, { email: 'not-an-address', name: 'Abbie' }), InviteError)
    await assert.rejects(sendInvite(actor, BASE, { email: 'a@b.invalid', name: '   ' }), InviteError)
  })

  it('replaces an outstanding invitation rather than having two live links', async () => {
    const actor = await designer()

    const first = await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })
    await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })

    const refreshed = await prisma.invite.findUniqueOrThrow({ where: { id: first.id } })
    assert.notEqual(refreshed.revokedAt, null, 'the first link still works')

    const live = await prisma.invite.count({
      where: { email: 'abbie@example.invalid', acceptedAt: null, revokedAt: null },
    })
    assert.equal(live, 1)
  })
})

describe('accepting an invitation', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('makes a client, never a designer', async () => {
    const actor = await designer()
    const home = await project()
    const invite = await sendInvite(actor, BASE, {
      email: 'abbie@example.invalid',
      name: 'Abbie Tigges',
      projectId: home.id,
      label: 'Abbie and Russell',
    })

    const result = await acceptInvite(await tokenFor(invite.id))
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.user.role, Role.CLIENT)
    assert.equal(result.user.signInEnabled, true)
    assert.equal(result.projectSlug, home.slug)

    const membership = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: home.id, userId: result.user.id } },
    })
    assert.equal(membership.label, 'Abbie and Russell')

    // The session it returns is a real one, resolvable the same way a cookie
    // from the ordinary sign-in route is.
    const resolved = await userForSessionToken(result.sessionToken)
    assert.equal(resolved?.id, result.user.id)
  })

  it('works once, and then says the account is set up instead', async () => {
    const actor = await designer()
    const invite = await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })
    const token = await tokenFor(invite.id)

    assert.equal((await acceptInvite(token)).ok, true)

    const again = await acceptInvite(token)
    assert.equal(again.ok, false)
    if (again.ok) return
    // Not "unknown". The difference is the whole point: this person should be
    // told to sign in, not told their link is broken.
    assert.equal(again.reason, 'spent')

    assert.equal(await prisma.user.count({ where: { email: 'abbie@example.invalid' } }), 1)
  })

  it('refuses one that has run out', async () => {
    const actor = await designer()
    const invite = await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })
    const token = await tokenFor(invite.id)
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await acceptInvite(token)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'expired')
    assert.equal(await prisma.user.count({ where: { email: 'abbie@example.invalid' } }), 0)
  })

  it('refuses one that was withdrawn', async () => {
    const actor = await designer()
    const invite = await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })
    const token = await tokenFor(invite.id)

    await revokeInvite(actor, invite.id)

    const result = await acceptInvite(token)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'revoked')
    assert.equal(await prisma.user.count({ where: { email: 'abbie@example.invalid' } }), 0)
  })

  it('refuses a made-up token', async () => {
    const result = await acceptInvite(randomBytes(32).toString('base64url'))
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'unknown')
  })

  it('will not let an accepted invitation be withdrawn afterwards', async () => {
    const actor = await designer()
    const invite = await sendInvite(actor, BASE, { email: 'abbie@example.invalid', name: 'Abbie' })
    await acceptInvite(await tokenFor(invite.id))

    await assert.rejects(revokeInvite(actor, invite.id), InviteError)
  })
})

describe('the public request form', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('records a message and grants nothing', async () => {
    await requestAccess({
      name: 'Abbie Tigges',
      email: 'Abbie@Example.Invalid',
      phone: '555 0100',
      note: 'GL Homes build, closing in the spring.',
    })

    const request = await prisma.accessRequest.findFirstOrThrow()
    assert.equal(request.email, 'abbie@example.invalid')
    assert.equal(request.status, AccessRequestStatus.PENDING)

    // The important half: nothing that lets anybody in came out of this.
    assert.equal(await prisma.user.count(), 0)
    assert.equal(await prisma.invite.count(), 0)
    assert.equal(await prisma.session.count(), 0)
  })

  it('caps the note rather than storing whatever was posted', async () => {
    await requestAccess({
      name: 'A'.repeat(500),
      email: 'abbie@example.invalid',
      note: 'B'.repeat(9000),
    })

    const request = await prisma.accessRequest.findFirstOrThrow()
    assert.ok(request.name.length <= 120, `name was ${request.name.length}`)
    assert.ok((request.note ?? '').length <= 2000, `note was ${request.note?.length}`)
  })

  it('quietly ignores the same address asking again, rather than saying so', async () => {
    await requestAccess({ name: 'Abbie', email: 'abbie@example.invalid' })
    // Resolves rather than throwing. Telling the browser "you already asked"
    // would make the form a way to check whether an address is known.
    await requestAccess({ name: 'Abbie', email: 'abbie@example.invalid' })

    assert.equal(await prisma.accessRequest.count(), 1)
  })

  it('lets the same address ask again once the window has passed', async () => {
    await requestAccess({ name: 'Abbie', email: 'abbie@example.invalid' })
    await prisma.accessRequest.updateMany({
      data: { createdAt: new Date(Date.now() - (REQUEST_WINDOW_MINUTES + 1) * 60_000) },
    })

    await requestAccess({ name: 'Abbie', email: 'abbie@example.invalid' })
    assert.equal(await prisma.accessRequest.count(), 2)
  })

  it('refuses something that is not an address', async () => {
    await assert.rejects(
      requestAccess({ name: 'Abbie', email: 'not-an-address' }),
      AccessRequestError,
    )
    assert.equal(await prisma.accessRequest.count(), 0)
  })
})

describe('dealing with a request', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  async function pending() {
    await requestAccess({ name: 'Abbie Tigges', email: 'abbie@example.invalid' })
    return prisma.accessRequest.findFirstOrThrow()
  }

  it('approving sends an invitation rather than making an account', async () => {
    const actor = await designer()
    const home = await project()
    const request = await pending()

    await approveAccessRequest(actor, request.id, BASE, home.id)

    const invite = await prisma.invite.findFirstOrThrow()
    assert.equal(invite.email, 'abbie@example.invalid')
    assert.equal(invite.projectId, home.id)

    // Still nobody in. The invitation is the thing that lets them in, which
    // is what makes an approval by accident recoverable.
    assert.equal(await prisma.user.count({ where: { role: Role.CLIENT } }), 0)

    const after = await prisma.accessRequest.findUniqueOrThrow({ where: { id: request.id } })
    assert.equal(after.status, AccessRequestStatus.APPROVED)
    assert.equal(after.reviewedById, actor.id)
  })

  it('will not approve the same one twice', async () => {
    const actor = await designer()
    const request = await pending()

    await approveAccessRequest(actor, request.id, BASE, null)
    await assert.rejects(
      approveAccessRequest(actor, request.id, BASE, null),
      AccessRequestError,
    )
    assert.equal(await prisma.invite.count(), 1)
  })

  it('leaves the request pending when the invitation could not be sent', async () => {
    const actor = await designer()
    const request = await pending()

    // An account on that address makes sendInvite refuse, which stands in for
    // any failure to send. The request must not be left marked approved with
    // nothing behind it.
    await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie', role: Role.CLIENT },
    })

    await assert.rejects(approveAccessRequest(actor, request.id, BASE, null), InviteError)

    const after = await prisma.accessRequest.findUniqueOrThrow({ where: { id: request.id } })
    assert.equal(after.status, AccessRequestStatus.PENDING)
  })

  it('declining records why and sends nothing', async () => {
    const actor = await designer()
    const request = await pending()

    await declineAccessRequest(actor, request.id, 'Out of our area')

    const after = await prisma.accessRequest.findUniqueOrThrow({ where: { id: request.id } })
    assert.equal(after.status, AccessRequestStatus.DECLINED)
    assert.equal(after.reviewNote, 'Out of our area')
    assert.equal(await prisma.invite.count(), 0)
  })
})
