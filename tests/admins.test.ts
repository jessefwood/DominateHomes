import assert from 'node:assert/strict'
import { afterEach, after, beforeEach, describe, it } from 'node:test'
import { Role } from '@prisma/client'
import { configuredAdminEmails, ensureConfiguredAdmin, isConfiguredAdmin } from '../lib/admins'
import { requestSignInLink } from '../lib/auth'
import { prisma, reset } from './helpers'

/**
 * The way back in.
 *
 * There is no password on this portal and no self-signup, so the failure that
 * has no recovery is both designer accounts being closed by accident or lost
 * in a bad restore. ADMIN_EMAILS is the answer to it: an address on that list
 * can always get a sign-in link, and gets a designer account whether or not
 * one exists.
 *
 * The property that keeps that from being a hole is that it only ever adds.
 * It cannot close an account, it cannot demote anybody, and an address that
 * is not on the list is unaffected by it existing. The tests below are mostly
 * about that.
 */

const BASE = 'https://portal.dominatehomes.com'
let saved: string | undefined

beforeEach(async () => {
  saved = process.env.ADMIN_EMAILS
  delete process.env.ADMIN_EMAILS
  await reset()
})

afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = saved
})

after(() => prisma.$disconnect())

describe('reading the list', () => {
  it('is empty when nothing is set, so nothing changes', () => {
    assert.deepEqual(configuredAdminEmails(), [])
    assert.equal(isConfiguredAdmin('davina@example.invalid'), false)
  })

  it('takes commas, spaces and newlines, and normalises case', () => {
    process.env.ADMIN_EMAILS = ' Davina@Example.Invalid, jesse@example.invalid\nextra@example.invalid '

    assert.deepEqual(configuredAdminEmails(), [
      'davina@example.invalid',
      'jesse@example.invalid',
      'extra@example.invalid',
    ])
    assert.equal(isConfiguredAdmin('DAVINA@example.invalid'), true)
  })

  it('ignores anything that is not an address', () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid,,  ,nonsense'
    assert.deepEqual(configuredAdminEmails(), ['davina@example.invalid'])
  })
})

describe('the account it guarantees', () => {
  it('does nothing at all for an address not on the list', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'

    assert.equal(await ensureConfiguredAdmin('someone@example.invalid'), null)
    assert.equal(await prisma.user.count(), 0)
  })

  it('creates a designer when there is no account', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'

    const user = await ensureConfiguredAdmin('Davina@Example.Invalid')

    assert.equal(user?.email, 'davina@example.invalid')
    assert.equal(user?.role, Role.DESIGNER)
    assert.equal(user?.signInEnabled, true)
  })

  it('reopens an account that was closed by accident', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'
    await prisma.user.create({
      data: {
        email: 'davina@example.invalid',
        name: 'Davina Hughes',
        role: Role.DESIGNER,
        signInEnabled: false,
      },
    })

    const user = await ensureConfiguredAdmin('davina@example.invalid')
    assert.equal(user?.signInEnabled, true)
    // The name they already had is kept. This is a way back in, not a reset.
    assert.equal(user?.name, 'Davina Hughes')
  })

  it('promotes a client row on a listed address', async () => {
    process.env.ADMIN_EMAILS = 'jesse@example.invalid'
    await prisma.user.create({
      data: { email: 'jesse@example.invalid', name: 'Jesse Wood', role: Role.CLIENT },
    })

    const user = await ensureConfiguredAdmin('jesse@example.invalid')
    assert.equal(user?.role, Role.DESIGNER)
  })

  it('never closes or demotes anybody', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'

    const abbie = await prisma.user.create({
      data: { email: 'abbie@example.invalid', name: 'Abbie Tigges', role: Role.CLIENT },
    })
    await ensureConfiguredAdmin('davina@example.invalid')

    const after = await prisma.user.findUniqueOrThrow({ where: { id: abbie.id } })
    assert.equal(after.role, Role.CLIENT)
    assert.equal(after.signInEnabled, true)
  })
})

describe('asking for a link on a listed address', () => {
  it('goes through even with no account in the database at all', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'

    const result = await requestSignInLink('davina@example.invalid', BASE)

    assert.equal(result.sent, true)
    if (!result.sent) return
    assert.equal(result.user.role, Role.DESIGNER)
    assert.equal(await prisma.loginToken.count({ where: { userId: result.user.id } }), 1)
  })

  it('goes through for a listed address whose account was closed', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'
    await prisma.user.create({
      data: {
        email: 'davina@example.invalid',
        name: 'Davina Hughes',
        role: Role.DESIGNER,
        signInEnabled: false,
      },
    })

    assert.equal((await requestSignInLink('davina@example.invalid', BASE)).sent, true)
  })

  it('still sends nothing for a closed account that is not on the list', async () => {
    process.env.ADMIN_EMAILS = 'davina@example.invalid'
    await prisma.user.create({
      data: {
        email: 'abbie@example.invalid',
        name: 'Abbie Tigges',
        role: Role.CLIENT,
        signInEnabled: false,
      },
    })

    // The rule in CLAUDE.md: a client stays locked out until the designer
    // says otherwise, and this must not be a way around that.
    assert.equal((await requestSignInLink('abbie@example.invalid', BASE)).sent, false)
    assert.equal(await prisma.loginToken.count(), 0)
  })

  it('still sends nothing for an unknown address when the list is empty', async () => {
    assert.equal((await requestSignInLink('nobody@example.invalid', BASE)).sent, false)
    assert.equal(await prisma.user.count(), 0)
  })
})
