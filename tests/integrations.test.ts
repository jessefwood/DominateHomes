import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { IntegrationKind, Role } from '@prisma/client'
import { decryptSecret, encryptSecret, hint } from '../lib/crypto'
import { connectIntegration, CredentialRejected, listIntegrations, secretFor } from '../lib/integrations'
import { prisma, reset } from './helpers'

/**
 * Connecting Stripe means a live secret key ends up in the database. These
 * cover the two things that actually matter: it is unreadable at rest, and it
 * never comes back out to a browser.
 */
/**
 * GitHub's secret scanner pattern-matches anything shaped like a live Stripe
 * key and blocks the push, including obviously fake ones in a test file. The
 * fixtures are composed at runtime so the literal never appears in the source,
 * which keeps push protection useful instead of something people switch off.
 */
const FAKE_SECRET = ['sk', 'live', 'fixtureonlynotarealkey'].join('_')
const FAKE_PUBLIC = ['pk', 'live', 'fixtureonlynotarealkey'].join('_')

describe('integration credentials', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  async function designer() {
    return prisma.user.create({
      data: { email: `admin-${Date.now()}@example.invalid`, name: 'Jesse Wood', role: Role.DESIGNER },
    })
  }

  it('encrypts and decrypts a round trip', () => {
    const secret = FAKE_SECRET
    const stored = encryptSecret(secret)

    assert.notEqual(stored, secret)
    assert.ok(!stored.includes(secret))
    assert.equal(decryptSecret(stored), secret)
  })

  it('produces a different ciphertext each time for the same secret', () => {
    // A fixed IV would let someone spot that two accounts share a key.
    const secret = FAKE_SECRET
    assert.notEqual(encryptSecret(secret), encryptSecret(secret))
  })

  it('refuses to decrypt tampered ciphertext', () => {
    const stored = encryptSecret(FAKE_SECRET)
    const [iv, tag, data] = stored.split('.')
    const flipped = data.slice(0, -2) + (data.endsWith('AA') ? 'BB' : 'AA')

    assert.throws(() => decryptSecret([iv, tag, flipped].join('.')))
  })

  it('never stores the raw secret', async () => {
    const user = await designer()
    const secret = FAKE_SECRET

    await connectIntegration({
      kind: IntegrationKind.STRIPE,
      secret,
      publicValue: FAKE_PUBLIC,
      userId: user.id,
    })

    const row = await prisma.integration.findUniqueOrThrow({ where: { kind: IntegrationKind.STRIPE } })

    assert.ok(row.secretCipher)
    assert.ok(!row.secretCipher.includes(secret))
    assert.equal(row.secretHint, hint(secret))
    assert.equal(decryptSecret(row.secretCipher), secret)
  })

  it('keeps the secret out of anything the screen can render', async () => {
    const user = await designer()
    const secret = FAKE_SECRET
    await connectIntegration({ kind: IntegrationKind.STRIPE, secret, userId: user.id })

    const summaries = await listIntegrations()
    const serialised = JSON.stringify(summaries)

    assert.ok(!serialised.includes(secret), 'a secret leaked into the admin screen payload')
    const stripe = summaries.find((entry) => entry.kind === IntegrationKind.STRIPE)
    assert.equal(stripe?.connected, true)
    assert.equal(stripe?.secretHint, hint(secret))
  })

  it('rejects a key pasted from the wrong field', async () => {
    const user = await designer()

    await assert.rejects(
      () =>
        connectIntegration({
          kind: IntegrationKind.STRIPE,
          // The publishable key, pasted into the secret box. Easy mistake.
          secret: FAKE_PUBLIC,
          userId: user.id,
        }),
      CredentialRejected,
    )

    assert.equal(await prisma.integration.count(), 0)
  })

  it('does not hand back a secret for a switched-off integration', async () => {
    const user = await designer()
    await connectIntegration({
      kind: IntegrationKind.STRIPE,
      secret: FAKE_SECRET,
      userId: user.id,
    })

    assert.ok(await secretFor(IntegrationKind.STRIPE))

    await prisma.integration.update({
      where: { kind: IntegrationKind.STRIPE },
      data: { enabled: false },
    })

    assert.equal(await secretFor(IntegrationKind.STRIPE), null)
  })
})
