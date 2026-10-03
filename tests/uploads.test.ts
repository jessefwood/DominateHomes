import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { Phase, Role, RoomTier, UploadKind, UploadSource } from '@prisma/client'
import {
  ALLOWED_UPLOAD_TYPES,
  beginUpload,
  formatBytes,
  kindFor,
  MAX_UPLOAD_BYTES,
  stillRestorable,
  trashUpload,
  TRASH_DAYS,
  UploadError,
} from '../lib/uploads'
import { fixture, prisma, reset } from './helpers'

/**
 * What a client is allowed to send us, and what happens to it afterwards.
 *
 * THE ONE THAT MATTERS is the allowlist. These files are previewed in a
 * browser, so a type the browser interprets as a document rather than as
 * media is a script running on whoever opens it. SVG is the trap: it looks
 * like an image, it is accepted everywhere as an image, and it can carry
 * script. There is a test below that says it is refused, and it should not be
 * relaxed to make an icon upload work.
 *
 * The rest is about the trash. Nothing in this application removes a client's
 * file: deleting sets a timestamp, and these say so.
 */

const CONNECTED = {
  S3_BUCKET: 'dominate-test',
  S3_KEY: 'AKIATESTTESTTESTTEST',
  S3_SECRET: 'not-a-real-secret-only-for-signing-in-tests',
  S3_ENDPOINT: 'https://storage.example.invalid',
  S3_REGION: 'auto',
}

const saved: Record<string, string | undefined> = {}

before(() => {
  for (const key of Object.keys(CONNECTED)) saved[key] = process.env[key]
})

after(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  await prisma.$disconnect()
})

describe('what a client may send', () => {
  it('refuses the formats a browser would run', () => {
    // SVG is the important one. The others are here so that a future pass at
    // this list has to delete a line to let one through.
    for (const type of [
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
      'application/xml',
      'text/xml',
      'application/x-httpd-php',
      'application/octet-stream',
    ]) {
      assert.equal(ALLOWED_UPLOAD_TYPES.has(type), false, `${type} is on the allowlist`)
    }
  })

  it('accepts what a phone and a laptop actually produce', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/heic',
      'video/mp4',
      'video/quicktime',
      'application/pdf',
    ]) {
      assert.equal(ALLOWED_UPLOAD_TYPES.has(type), true, `${type} is refused`)
    }
  })
})

describe('sorting a file into a section', () => {
  it('reads the family off the type', () => {
    assert.equal(kindFor('image/jpeg'), UploadKind.PHOTO)
    assert.equal(kindFor('video/quicktime'), UploadKind.VIDEO)
    assert.equal(kindFor('application/pdf'), UploadKind.DOCUMENT)
    assert.equal(kindFor('text/csv'), UploadKind.DOCUMENT)
    assert.equal(
      kindFor('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      UploadKind.DOCUMENT,
    )
    assert.equal(kindFor('application/zip'), UploadKind.OTHER)
  })
})

describe('a size a person can read', () => {
  it('scales the unit to the number', () => {
    assert.equal(formatBytes(512), '512 bytes')
    assert.equal(formatBytes(2048), '2 KB')
    assert.equal(formatBytes(4_404_019), '4.2 MB')
    assert.equal(formatBytes(367_001_600), '350 MB')
  })
})

describe('the trash', () => {
  it('holds a file, rather than the file being gone', () => {
    const justNow = new Date()
    assert.equal(stillRestorable({ deletedAt: justNow }, justNow), true)
  })

  it('counts the 30 days from when it was removed', () => {
    const removed = new Date('2026-01-01T00:00:00Z')
    const inside = new Date(removed.getTime() + (TRASH_DAYS - 1) * 86_400_000)
    const outside = new Date(removed.getTime() + (TRASH_DAYS + 1) * 86_400_000)

    assert.equal(stillRestorable({ deletedAt: removed }, inside), true)
    assert.equal(stillRestorable({ deletedAt: removed }, outside), false)
  })

  it('treats a file that was never removed as fine', () => {
    assert.equal(stillRestorable({ deletedAt: null }), true)
  })
})

describe('starting an upload', () => {
  beforeEach(async () => {
    await reset()
    Object.assign(process.env, CONNECTED)
  })

  afterEach(() => {
    for (const key of Object.keys(CONNECTED)) delete process.env[key]
  })

  it('refuses a type that is not on the allowlist', async () => {
    const { user, project } = await fixture()

    await assert.rejects(
      beginUpload(user, project, { filename: 'trouble.svg', contentType: 'image/svg+xml', sizeBytes: 100 }),
      UploadError,
    )
  })

  it('refuses a file over the limit before minting a link', async () => {
    const { user, project } = await fixture()

    await assert.rejects(
      beginUpload(user, project, {
        filename: 'walkthrough.mp4',
        contentType: 'video/mp4',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      }),
      UploadError,
    )

    // Nothing reserved, so there is no row left behind pointing at a key
    // that will never hold anything.
    assert.equal(await prisma.upload.count(), 0)
  })

  it('refuses an empty file', async () => {
    const { user, project } = await fixture()

    await assert.rejects(
      beginUpload(user, project, { filename: 'a.jpg', contentType: 'image/jpeg', sizeBytes: 0 }),
      UploadError,
    )
  })

  it('refuses to file a photograph against another project’s room', async () => {
    const { user, project } = await fixture()

    const other = await prisma.project.create({
      data: {
        slug: `other-${Date.now()}`,
        displayName: 'Somewhere else',
        community: 'Test',
        planName: 'Test',
        acSqFt: 1,
        totalSqFt: 1,
        phase: Phase.SELECTIONS,
        clientName: 'Someone else',
        designer: 'Davina Hughes',
        allocationCents: 1,
      },
    })

    const theirRoom = await prisma.room.create({
      data: {
        projectId: other.id,
        name: 'Their Great Room',
        slug: 'their-great-room',
        order: 1,
        tier: RoomTier.MAJOR,
        budgetLowCents: 1,
        budgetMidCents: 1,
        budgetHighCents: 1,
        contents: 'Theirs',
      },
    })

    await assert.rejects(
      beginUpload(user, project, {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 100,
        roomId: theirRoom.id,
      }),
      UploadError,
    )
  })

  it('reserves a row under this project with the upload id in the key', async () => {
    const { user, project, room } = await fixture()

    const started = await beginUpload(user, project, {
      filename: 'IMG_4821.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1_234_567,
      roomId: room.id,
      caption: 'Wall behind the sofa is 14 feet 6',
    })

    const row = await prisma.upload.findUniqueOrThrow({ where: { id: started.uploadId } })

    assert.equal(row.projectId, project.id)
    assert.equal(row.roomId, room.id)
    assert.equal(row.storageKey, `projects/${project.id}/${row.id}/IMG_4821.jpg`)
    assert.equal(row.source, UploadSource.CLIENT)
    assert.equal(row.kind, UploadKind.PHOTO)
    assert.equal(row.caption, 'Wall behind the sofa is 14 feet 6')
    // Not real until the bucket has been asked. Nothing shows it yet.
    assert.equal(row.confirmedAt, null)
    assert.ok(started.url.includes('X-Amz-Signature='))
  })

  it('says so plainly when no bucket is connected', async () => {
    const { user, project } = await fixture()
    for (const key of Object.keys(CONNECTED)) delete process.env[key]

    await assert.rejects(
      beginUpload(user, project, { filename: 'a.jpg', contentType: 'image/jpeg', sizeBytes: 10 }),
      (error: unknown) => error instanceof UploadError && /not switched on/i.test(error.message),
    )
  })
})

describe('removing a file', () => {
  beforeEach(async () => {
    await reset()
    Object.assign(process.env, CONNECTED)
  })

  afterEach(() => {
    for (const key of Object.keys(CONNECTED)) delete process.env[key]
  })

  it('does not remove it, it dates it', async () => {
    const { user, project } = await fixture()
    // The fixture does not attach its client to the project, and removing a
    // file goes through requireProjectAccess, so without this the test gets
    // a not found and proves nothing about the trash.
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } })

    const started = await beginUpload(user, project, {
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    })
    await prisma.upload.update({
      where: { id: started.uploadId },
      data: { confirmedAt: new Date() },
    })

    await trashUpload(user, started.uploadId)

    const row = await prisma.upload.findUniqueOrThrow({ where: { id: started.uploadId } })
    assert.notEqual(row.deletedAt, null)
    assert.equal(row.deletedById, user.id)
    // The row is still there. That is the whole point.
    assert.equal(await prisma.upload.count(), 1)
  })

  it('will not let one client remove another client’s file', async () => {
    const { user, project } = await fixture()
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } })

    const started = await beginUpload(user, project, {
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    })
    await prisma.upload.update({
      where: { id: started.uploadId },
      data: { confirmedAt: new Date() },
    })

    // A second client, on the same project, which is the case a couple
    // sharing a build actually produces.
    const other = await prisma.user.create({
      data: {
        email: `other-${Date.now()}@example.invalid`,
        name: 'Russell',
        role: Role.CLIENT,
      },
    })
    await prisma.projectMember.create({ data: { projectId: project.id, userId: other.id } })

    await assert.rejects(trashUpload(other, started.uploadId), UploadError)

    const row = await prisma.upload.findUniqueOrThrow({ where: { id: started.uploadId } })
    assert.equal(row.deletedAt, null)
  })
})
