import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'
import { credentialKeyProblem } from '../lib/crypto'

/**
 * Regression cover for a security defect that nearly shipped.
 *
 * The check used to be "present and at least 16 characters", stretched with
 * scrypt. The instruction we show contains a command, and the obvious
 * misreading is to paste the command rather than run it. That string is 23
 * characters, so it passed, the warning cleared, and a live Stripe key would
 * have been encrypted under a phrase printed in our own error message.
 *
 * The property worth holding: only the actual output of
 * `openssl rand -base64 32` is accepted, and every rejection says which way
 * it failed so the next person is not guessing.
 */
describe('CREDENTIAL_KEY validation', () => {
  it('accepts what openssl rand -base64 32 actually prints', () => {
    for (let i = 0; i < 25; i += 1) {
      const real = randomBytes(32).toString('base64')
      assert.equal(credentialKeyProblem(real), null, `rejected a real key: ${real}`)
    }
  })

  it('tolerates the trailing newline a copy and paste brings along', () => {
    const real = randomBytes(32).toString('base64')
    assert.equal(credentialKeyProblem(`  ${real}\n`), null)
  })

  it('accepts the base64url spelling of the same 32 bytes', () => {
    // Keep generating until we get one with a character that differs between
    // the two alphabets, so the assertion is actually about the spelling.
    let real = randomBytes(32).toString('base64')
    while (!/[+/]/.test(real)) real = randomBytes(32).toString('base64')

    assert.equal(credentialKeyProblem(real.replace(/\+/g, '-').replace(/\//g, '_')), null)
  })

  // THE ONE THAT MATTERS.
  it('rejects the command itself, which is what was actually pasted', () => {
    assert.equal(credentialKeyProblem('openssl rand -base64 32'), 'pasted-the-command')
    assert.equal(credentialKeyProblem('$ openssl rand -base64 32'), 'pasted-the-command')
    assert.equal(credentialKeyProblem('OPENSSL RAND -BASE64 32'), 'pasted-the-command')
  })

  it('rejects an unset or blank value', () => {
    assert.equal(credentialKeyProblem(undefined), 'missing')
    assert.equal(credentialKeyProblem(''), 'missing')
    assert.equal(credentialKeyProblem('   '), 'missing')
  })

  it('rejects base64 of the wrong length, which is the near miss', () => {
    assert.equal(credentialKeyProblem(randomBytes(16).toString('base64')), 'wrong-length')
    assert.equal(credentialKeyProblem(randomBytes(31).toString('base64')), 'wrong-length')
    assert.equal(credentialKeyProblem(randomBytes(64).toString('base64')), 'wrong-length')
  })

  it('rejects a passphrase someone typed, however long', () => {
    assert.notEqual(credentialKeyProblem('correct horse battery staple'), null)
    assert.notEqual(credentialKeyProblem('a-very-long-password-that-is-not-base64!!'), null)
    assert.notEqual(credentialKeyProblem('dominate homes credential key 2026'), null)
  })

  it('never accepts a value shorter than the real thing', () => {
    for (const bad of ['x', 'abcd', 'hunter2', 'changeme', 'secret']) {
      assert.notEqual(credentialKeyProblem(bad), null, `accepted ${bad}`)
    }
  })
})
