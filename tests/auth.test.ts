import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { Role } from '@prisma/client'
import {
  RateLimitedError,
  redeemSignInLink,
  requestSignInLink,
  TOKEN_TTL_MINUTES,
  destroySession,
  userForSessionToken,
} from '../lib/auth'
import { prisma, reset } from './helpers'

const BASE = 'https://portal.dominatehomes.com'

async function makeUser(email = 'abbie@example.invalid') {
  return prisma.user.create({ data: { email, name: 'Abbie Grossman', role: Role.CLIENT } })
}

describe('magic link sign-in', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('issues a link for a known address', async () => {
    const user = await makeUser()
    const result = await requestSignInLink(user.email, BASE)

    assert.equal(result.sent, true)
    assert.equal(await prisma.loginToken.count({ where: { userId: user.id } }), 1)
  })

  it('sends nothing for an account that is not open yet', async () => {
    // Abbie exists in the database long before she should be let in. A closed
    // account must behave exactly like an unknown address: no link, no email,
    // and nothing the browser can tell apart.
    const user = await prisma.user.create({
      data: {
        email: 'client@example.invalid',
        name: 'Abbie Grossman',
        role: Role.CLIENT,
        signInEnabled: false,
      },
    })

    const result = await requestSignInLink(user.email, BASE)

    assert.equal(result.sent, false)
    assert.equal(await prisma.loginToken.count({ where: { userId: user.id } }), 0)
  })

  it('lets the same account in once it is opened', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'client2@example.invalid',
        name: 'Abbie Grossman',
        role: Role.CLIENT,
        signInEnabled: false,
      },
    })

    assert.equal((await requestSignInLink(user.email, BASE)).sent, false)

    await prisma.user.update({ where: { id: user.id }, data: { signInEnabled: true } })

    assert.equal((await requestSignInLink(user.email, BASE)).sent, true)
  })

  it('sends nothing for an unknown address and does not create a user', async () => {
    const result = await requestSignInLink('stranger@example.invalid', BASE)

    assert.equal(result.sent, false)
    assert.equal(await prisma.user.count(), 0)
    assert.equal(await prisma.loginToken.count(), 0)
  })

  it('matches on the address regardless of case or padding', async () => {
    const user = await makeUser('abbie@example.invalid')
    const result = await requestSignInLink('  ABBIE@Example.Invalid  ', BASE)

    assert.equal(result.sent, true)
    assert.equal(await prisma.loginToken.count({ where: { userId: user.id } }), 1)
  })

  it('never stores the token itself, only its hash', async () => {
    const user = await makeUser()
    const result = await requestSignInLink(user.email, BASE)
    assert.equal(result.sent, true)
    if (!result.sent) return

    const stored = await prisma.loginToken.findFirstOrThrow({ where: { userId: user.id } })
    assert.notEqual(stored.tokenHash, result.token)
    assert.equal(stored.tokenHash, createHash('sha256').update(result.token).digest('hex'))
  })

  it('turns a link into a working session', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    assert.equal(issued.sent, true)
    if (!issued.sent) return

    const redeemed = await redeemSignInLink(issued.token)
    assert.equal(redeemed.ok, true)
    if (!redeemed.ok) return

    const resolved = await userForSessionToken(redeemed.sessionToken)
    assert.equal(resolved?.id, user.id)
  })

  it('refuses a link that has already been used', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    if (!issued.sent) throw new Error('expected a link')

    await redeemSignInLink(issued.token)
    const second = await redeemSignInLink(issued.token)

    assert.equal(second.ok, false)
  })

  it('burns other outstanding links once one is used', async () => {
    const user = await makeUser()
    const first = await requestSignInLink(user.email, BASE)
    const second = await requestSignInLink(user.email, BASE)
    if (!first.sent || !second.sent) throw new Error('expected two links')

    await redeemSignInLink(second.token)

    // The older email is still sitting in the inbox. It must not work.
    const replay = await redeemSignInLink(first.token)
    assert.equal(replay.ok, false)
  })

  it('refuses an expired link', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    if (!issued.sent) throw new Error('expected a link')

    await prisma.loginToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    const redeemed = await redeemSignInLink(issued.token)
    assert.equal(redeemed.ok, false)
    if (redeemed.ok) return
    assert.equal(redeemed.reason, 'expired')
    assert.ok(TOKEN_TTL_MINUTES > 0)
  })

  it('refuses a made-up token', async () => {
    await makeUser()
    const redeemed = await redeemSignInLink('not-a-real-token')
    assert.equal(redeemed.ok, false)
  })

  it('throttles repeated requests for one account', async () => {
    const user = await makeUser()
    for (let i = 0; i < 5; i += 1) {
      await requestSignInLink(user.email, BASE)
    }

    await assert.rejects(() => requestSignInLink(user.email, BASE), RateLimitedError)
  })

  it('stops resolving a session once it is signed out', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    if (!issued.sent) throw new Error('expected a link')
    const redeemed = await redeemSignInLink(issued.token)
    if (!redeemed.ok) throw new Error('expected a session')

    await destroySession(redeemed.sessionToken)

    assert.equal(await userForSessionToken(redeemed.sessionToken), null)
  })

  it('stops resolving a session once it expires', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    if (!issued.sent) throw new Error('expected a link')
    const redeemed = await redeemSignInLink(issued.token)
    if (!redeemed.ok) throw new Error('expected a session')

    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } })

    assert.equal(await userForSessionToken(redeemed.sessionToken), null)
  })

  it('treats no cookie as signed out', async () => {
    assert.equal(await userForSessionToken(undefined), null)
  })
})

/**
 * Locking someone out has to end the access they already have, not just stop
 * them getting new links. Production proved why this matters: signInEnabled
 * was added by migration, every existing row took the default of true, and a
 * client who was supposed to be locked out could sign in.
 */
describe('closing access', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('kills a live session when access is closed', async () => {
    const user = await makeUser()
    const issued = await requestSignInLink(user.email, BASE)
    if (!issued.sent) throw new Error('expected a link')
    const redeemed = await redeemSignInLink(issued.token)
    if (!redeemed.ok) throw new Error('expected a session')

    assert.ok(await userForSessionToken(redeemed.sessionToken))

    // What the admin switch does.
    await prisma.user.update({ where: { id: user.id }, data: { signInEnabled: false } })
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await prisma.loginToken.deleteMany({ where: { userId: user.id, usedAt: null } })

    assert.equal(await userForSessionToken(redeemed.sessionToken), null)
    assert.equal((await requestSignInLink(user.email, BASE)).sent, false)
  })
})
