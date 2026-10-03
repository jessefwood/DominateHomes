import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  cleanFilename,
  contentTypeFor,
  signedDownloadUrl,
  signedUploadUrl,
  storageConfigured,
  StorageNotConfiguredError,
  uploadKey,
} from '../lib/storage'

/**
 * The storage client signs its own requests, so the tests that matter are
 * about what cannot happen rather than about whether a signature verifies.
 *
 * Two of them are the reason this file exists:
 *
 *   A FILENAME CANNOT ESCAPE ITS FOLDER. A filename arrives from a phone and
 *   goes straight into a storage key. If `../../` survived cleaning, a client
 *   could write over another project's files, or over a backup.
 *
 *   NOTHING IS READABLE WITHOUT A SIGNATURE. There is no function in the
 *   storage client that returns a plain bucket URL, and a link that is handed
 *   out always carries an expiry. If one of those stops being true, every
 *   access check in the application is decoration.
 */

const KEYS = ['S3_BUCKET', 'S3_KEY', 'S3_SECRET', 'S3_ENDPOINT', 'S3_REGION'] as const
const saved: Record<string, string | undefined> = {}

function connect() {
  process.env.S3_BUCKET = 'dominate-test'
  process.env.S3_KEY = 'AKIATESTTESTTESTTEST'
  process.env.S3_SECRET = 'not-a-real-secret-only-for-signing-in-tests'
  process.env.S3_ENDPOINT = 'https://storage.example.invalid'
  process.env.S3_REGION = 'auto'
}

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key]
  for (const key of KEYS) delete process.env[key]
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('a filename from somebody else’s phone', () => {
  it('cannot climb out of its folder', () => {
    assert.equal(cleanFilename('../../backups/everything.zip'), 'backupseverything.zip')
    assert.ok(!cleanFilename('../../../etc/passwd').includes('/'))
    assert.ok(!cleanFilename('..\\..\\windows\\system32').includes('\\'))
  })

  it('cannot become a hidden file or an empty key', () => {
    assert.equal(cleanFilename('.env'), 'env')
    assert.equal(cleanFilename('...'), 'file')
    assert.equal(cleanFilename(''), 'file')
    assert.equal(cleanFilename('///'), 'file')
  })

  it('keeps the name recognisable', () => {
    assert.equal(cleanFilename('IMG_4821.HEIC'), 'IMG_4821.HEIC')
    assert.equal(cleanFilename('great room wall.jpg'), 'great-room-wall.jpg')
    assert.equal(cleanFilename('Sofa – Arhaus “Dune”.pdf'), 'Sofa-Arhaus-Dune.pdf')
  })

  it('is capped, so a key cannot be made enormous', () => {
    assert.ok(cleanFilename('a'.repeat(5000)).length <= 120)
  })
})

describe('where a file lands', () => {
  it('is grouped by project and made unique by the upload id', () => {
    const key = uploadKey('proj_abc', 'upl_123', 'IMG_4821.jpg')
    assert.equal(key, 'projects/proj_abc/upl_123/IMG_4821.jpg')
  })

  it('cannot be steered somewhere else by the filename', () => {
    const key = uploadKey('proj_abc', 'upl_123', '../../../backups/wipe.zip')
    assert.ok(key.startsWith('projects/proj_abc/upl_123/'), key)
    assert.equal(key.split('/').length, 4, key)
  })
})

describe('when no bucket is connected', () => {
  it('says so rather than half working', () => {
    assert.equal(storageConfigured(), false)
    assert.throws(() => signedDownloadUrl('projects/a/b/c.jpg'), StorageNotConfiguredError)
    assert.throws(() => signedUploadUrl('projects/a/b/c.jpg'), StorageNotConfiguredError)
  })

  it('needs all four values, not three', () => {
    connect()
    delete process.env.S3_SECRET
    assert.equal(storageConfigured(), false)
  })
})

describe('a link handed to a browser', () => {
  beforeEach(connect)

  it('always carries a signature and an expiry', () => {
    const url = new URL(signedDownloadUrl('projects/p/u/IMG_4821.jpg'))

    assert.equal(url.protocol, 'https:')
    assert.equal(url.host, 'dominate-test.storage.example.invalid')
    assert.equal(url.pathname, '/projects/p/u/IMG_4821.jpg')
    assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/)
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
    assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host')
  })

  it('expires in minutes by default, not days', () => {
    const url = new URL(signedDownloadUrl('projects/p/u/a.jpg'))
    const expires = Number(url.searchParams.get('X-Amz-Expires'))
    assert.ok(expires > 0 && expires <= 900, `expiry was ${expires} seconds`)
  })

  it('refuses to mint one that outlives the week S3 allows', () => {
    const url = new URL(signedDownloadUrl('projects/p/u/a.jpg', { expires: 99_999_999 }))
    assert.equal(url.searchParams.get('X-Amz-Expires'), '604800')
  })

  it('signs a different key to a different signature', () => {
    const one = new URL(signedDownloadUrl('projects/p/u/a.jpg')).searchParams.get('X-Amz-Signature')
    const two = new URL(signedDownloadUrl('projects/p/u/b.jpg')).searchParams.get('X-Amz-Signature')
    assert.notEqual(one, two)
  })

  it('names the file on a download without letting it break the header', () => {
    const url = new URL(
      signedDownloadUrl('projects/p/u/a.jpg', { download: 'wall "north"\r\nX-Evil: yes.jpg' }),
    )
    const disposition = url.searchParams.get('response-content-disposition') ?? ''

    assert.ok(disposition.startsWith('attachment;'), disposition)
    assert.ok(!disposition.includes('\r'), 'a newline survived into the header')
    assert.ok(!disposition.includes('\n'), 'a newline survived into the header')
    assert.ok(!/filename="[^"]*"[^;]/.test(disposition), disposition)
  })

  it('percent-encodes a path so the signature covers what the server sees', () => {
    const url = signedDownloadUrl('projects/p/u/a b+c.jpg')
    // Raw spaces and pluses in a path are read differently by different
    // servers, and any difference means a signature over another string.
    const path = url.slice(url.indexOf('/projects'), url.indexOf('?'))
    assert.equal(path, '/projects/p/u/a%20b%2Bc.jpg')
  })
})

describe('guessing a type from a name', () => {
  it('knows what phones produce', () => {
    assert.equal(contentTypeFor('IMG_4821.HEIC'), 'image/heic')
    assert.equal(contentTypeFor('walkthrough.MOV'), 'video/quicktime')
    assert.equal(contentTypeFor('plan.pdf'), 'application/pdf')
  })

  it('falls back rather than guessing something a browser would run', () => {
    assert.equal(contentTypeFor('notes'), 'application/octet-stream')
    assert.equal(contentTypeFor('trouble.svg'), 'application/octet-stream')
    assert.equal(contentTypeFor('trouble.html'), 'application/octet-stream')
  })
})

/**
 * A fixed signature, so a refactor cannot quietly break signing.
 *
 * Signature V4 fails in a way that is impossible to debug from the outside: a
 * wrong byte anywhere in the canonical request produces a valid-looking URL
 * and a flat 403 from the bucket, with no clue which of the dozen inputs was
 * wrong. So the value below is pinned.
 *
 * WHERE THE VALUE COMES FROM. It is the AWS documentation's own presigned GET
 * example inputs (examplebucket, test.txt, the published example key pair,
 * us-east-1, 24 hours, frozen at 2013-05-24T00:00:00Z), and the signature was
 * computed independently with openssl, by hand, outside this codebase:
 *
 *   canonical request sha256
 *     3bfa292879f6447bbcda7001decf97f4a54dc650c8942174ae0a9121cf58ad04
 *   signature
 *     3ed0be64024db54d5574a27da223529635c383f911f80e636f0ccc13890053d2
 *
 * Two different implementations agreeing on the same inputs is what makes
 * this worth having. It is not a certificate of correctness against a live
 * bucket, which only a live bucket can give.
 */
describe('the signature itself', () => {
  const EXAMPLE = {
    S3_BUCKET: 'examplebucket',
    S3_KEY: 'AKIAIOSFODNN7EXAMPLE',
    // The key pair published in the AWS signing documentation. It has never
    // been live anywhere.
    S3_SECRET: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    S3_ENDPOINT: 'https://s3.amazonaws.com',
    S3_REGION: 'us-east-1',
  }

  const RealDate = Date

  beforeEach(() => {
    Object.assign(process.env, EXAMPLE)

    const frozen = new RealDate('2013-05-24T00:00:00Z').getTime()

    // Only the no-argument form is frozen, which is the one lib/storage.ts
    // uses for its timestamp. Everything else is passed through, so a date
    // built from a literal still means what it says.
    class Frozen extends RealDate {
      constructor(...args: [] | [number | string | Date]) {
        super(args.length === 0 ? frozen : (args[0] as number))
      }
      static now() {
        return frozen
      }
    }
    globalThis.Date = Frozen as unknown as DateConstructor
  })

  afterEach(() => {
    globalThis.Date = RealDate
  })

  it('matches a signature computed outside this codebase', () => {
    const url = new URL(signedDownloadUrl('test.txt', { expires: 86400 }))

    assert.equal(
      url.searchParams.get('X-Amz-Signature'),
      '3ed0be64024db54d5574a27da223529635c383f911f80e636f0ccc13890053d2',
    )
  })

  it('puts the credential scope together the way S3 reads it', () => {
    const url = new URL(signedDownloadUrl('test.txt', { expires: 86400 }))

    assert.equal(
      url.searchParams.get('X-Amz-Credential'),
      'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
    )
    assert.equal(url.searchParams.get('X-Amz-Date'), '20130524T000000Z')
  })

  it('signs an upload differently from a download of the same key', () => {
    // The method is part of the canonical request. If it were not, a link
    // handed out for reading would also be a link for overwriting.
    const read = new URL(signedDownloadUrl('test.txt', { expires: 86400 }))
    const write = new URL(signedUploadUrl('test.txt', 86400))

    assert.notEqual(
      read.searchParams.get('X-Amz-Signature'),
      write.searchParams.get('X-Amz-Signature'),
    )
  })
})
