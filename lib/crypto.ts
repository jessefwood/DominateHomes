import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * Encrypting third party credentials before they go in the database.
 *
 * Jesse connects Stripe through the admin screen, which means a live secret
 * key ends up stored somewhere. Stored in plaintext, a database dump or a
 * stray backup hands someone the ability to move money. So it is encrypted at
 * rest with AES-256-GCM, and the master key lives in the hosting environment
 * rather than the repository.
 *
 * This protects against the database being read. It does not protect against
 * the running application being compromised, because the app must be able to
 * decrypt in order to use the key. That is the normal limit of encryption at
 * rest and worth being clear about rather than implying more.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const SALT = 'dominate-homes-credentials-v1'

export class MissingCredentialKeyError extends Error {
  constructor(readonly detail: string) {
    super(
      `${detail} Generate one by running this in a terminal, then paste the output ` +
        '(not the command) into Railway as CREDENTIAL_KEY: openssl rand -base64 32',
    )
    this.name = 'MissingCredentialKeyError'
  }
}

/**
 * Why this is checked rather than accepted.
 *
 * The first version asked only that the value be present and at least 16
 * characters, and stretched whatever it got with scrypt. That is wrong in a
 * specific and nasty way: the instruction above contains a command, and the
 * obvious misreading is to paste the command instead of running it. The string
 * `openssl rand -base64 32` is 23 characters, so it sailed through, the
 * warning on /admin/integrations cleared, and a live Stripe key would have
 * been encrypted under a phrase printed in our own error message. That is
 * worse than being broken, because nothing afterwards looks wrong.
 *
 * So the value has to be what the command actually produces: base64 that
 * decodes to 32 bytes. Anything else fails loudly and says which way it
 * failed, and the two likely mistakes get their own messages rather than a
 * generic one.
 *
 * `Buffer.from(value, 'base64')` is permissive and will not tell us the input
 * was malformed, so the byte length of the decode is the check, and
 * re-encoding and comparing catches input that merely contained some base64.
 */
export type KeyProblem = 'missing' | 'pasted-the-command' | 'not-base64' | 'wrong-length'

/**
 * The value is always passed in rather than defaulting to the environment.
 * A default of `process.env.CREDENTIAL_KEY` reads the same either way when
 * the argument is `undefined`, so asking "what is wrong with an unset value"
 * silently became "what is wrong with the one this machine happens to have",
 * and the answer changed with the environment. Callers that mean the
 * environment say so.
 */
export function credentialKeyProblem(raw: string | undefined | null): KeyProblem | null {
  const value = raw?.trim()

  if (!value) return 'missing'
  if (/openssl|rand\s|base64\s+32/i.test(value)) return 'pasted-the-command'

  const decoded = Buffer.from(value, 'base64')

  // A 32 byte key is 44 base64 characters including the single pad character.
  if (decoded.length !== 32) {
    return /^[A-Za-z0-9+/_-]+={0,2}$/.test(value) ? 'wrong-length' : 'not-base64'
  }

  // Re-encoding has to round trip, or the input was not clean base64 and the
  // decode quietly ignored part of it.
  const canonical = decoded.toString('base64')
  if (canonical !== value && canonical.replace(/\+/g, '-').replace(/\//g, '_') !== value) {
    return 'not-base64'
  }

  return null
}

export const KEY_PROBLEM_DETAIL: Record<KeyProblem, string> = {
  missing:
    'CREDENTIAL_KEY is not set in the hosting environment, so third party credentials cannot be stored or read.',
  'pasted-the-command':
    'CREDENTIAL_KEY looks like the command rather than its output, so it is a publicly known string and not a secret. Run the command and paste what it prints.',
  'not-base64': 'CREDENTIAL_KEY is not valid base64, so it did not come from the command below.',
  'wrong-length':
    'CREDENTIAL_KEY is valid base64 but does not decode to 32 bytes, so it did not come from the command below.',
}

/** The configured key, or `undefined` when the hosting environment has none. */
export function configuredCredentialKey(): string | undefined {
  return process.env.CREDENTIAL_KEY
}

function key(): Buffer {
  const problem = credentialKeyProblem(configuredCredentialKey())
  if (problem) throw new MissingCredentialKeyError(KEY_PROBLEM_DETAIL[problem])

  // scrypt, not the decoded bytes directly, because that is what every value
  // already in the database was encrypted under. The validation above is what
  // stops a weak input reaching here; changing the derivation now would make
  // existing ciphertext undecryptable for no security gain.
  return scryptSync(process.env.CREDENTIAL_KEY!.trim(), SALT, 32)
}

export function credentialKeyConfigured(): boolean {
  return credentialKeyProblem(configuredCredentialKey()) === null
}

/** Returns iv.tag.ciphertext, all base64url, in one string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(stored: string): string {
  const [ivPart, tagPart, dataPart] = stored.split('.')
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Stored credential is malformed. It was not written by this application.')
  }

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  // Throws if the ciphertext or the key is wrong, which is what we want:
  // a silently wrong key would send a garbage secret to a payment provider.
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/** Last four characters, for showing which key is in place without revealing it. */
export function hint(secret: string): string {
  return secret.length <= 4 ? '****' : secret.slice(-4)
}
