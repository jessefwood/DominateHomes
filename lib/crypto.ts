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
  constructor() {
    super(
      'CREDENTIAL_KEY is not set, so third party credentials cannot be stored or read. ' +
        'Generate one with: openssl rand -base64 32',
    )
    this.name = 'MissingCredentialKeyError'
  }
}

function key(): Buffer {
  const secret = process.env.CREDENTIAL_KEY
  if (!secret || secret.length < 16) throw new MissingCredentialKeyError()
  // scrypt stretches whatever was pasted into a proper 32 byte key, so a
  // short-but-present value does not silently become a weak cipher key.
  return scryptSync(secret, SALT, 32)
}

export function credentialKeyConfigured(): boolean {
  const secret = process.env.CREDENTIAL_KEY
  return Boolean(secret && secret.length >= 16)
}

/** Returns iv.tag.ciphertext, all base64url, in one string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
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
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8')
}

/** Last four characters, for showing which key is in place without revealing it. */
export function hint(secret: string): string {
  return secret.length <= 4 ? '****' : secret.slice(-4)
}
