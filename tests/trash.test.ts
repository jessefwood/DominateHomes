import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { AuditAction, Phase, Role, UploadKind, UploadSource } from '@prisma/client'
import { postMessage, deleteMessage, messagesForProject } from '../lib/messages'
import {
  restoreFile,
  restoreMessage,
  trashCount,
  trashedFiles,
  trashedMessages,
  TRASH_DAYS,
} from '../lib/trash'
import { trashUpload, uploadsForProject } from '../lib/uploads'
import { prisma, reset } from './helpers'

/**
 * Nothing in this application permanently deletes a client's work.
 *
 * That is the whole claim, and these are the tests that hold it up. Removing
 * sets a date. The row stays. A designer can put it back, and there is no job
 * anywhere that clears the trash out on a timer, which is deliberate: a timer
 * that destroys client work while nobody is watching is the thing being
 * avoided, not the thing being built.
 *
 * The 30 days decide what shows at the top of the trash screen, not what can
 * be restored. There is a test below that restores something older than that
 * on purpose.
 */

async function setup() {
  const suffix = randomBytes(4).toString('hex')

  const davina = await prisma.user.create({
    data: { email: `davina-${suffix}@example.invalid`, name: 'Davina Hughes', role: Role.DESIGNER },
  })
  const abbie = await prisma.user.create({
    data: { email: `abbie-${suffix}@example.invalid`, name: 'Abbie Tigges', role: Role.CLIENT },
  })

  const project = await prisma.project.create({
    data: {
      slug: `p-${suffix}`,
      displayName: '643 Bianca',
      community: 'Test',
      planName: 'Bianca',
      acSqFt: 1,
      totalSqFt: 1,
      phase: Phase.SELECTIONS,
      clientName: 'Abbie Tigges',
      designer: 'Davina Hughes',
      allocationCents: 1,
    },
  })

  await prisma.projectMember.create({ data: { projectId: project.id, userId: abbie.id } })

  const file = await prisma.upload.create({
    data: {
      projectId: project.id,
      uploadedById: abbie.id,
      storageKey: `projects/${project.id}/${suffix}/IMG_4821.jpg`,
      filename: 'IMG_4821.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1_234_567,
      kind: UploadKind.PHOTO,
      source: UploadSource.CLIENT,
      confirmedAt: new Date(),
    },
  })

  return { davina, abbie, project, file }
}

describe('removing a file', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('takes it off the project but not out of the database', async () => {
    const { abbie, project, file } = await setup()

    await trashUpload(abbie, file.id)

    assert.equal((await uploadsForProject(project.id)).length, 0)
    assert.equal((await trashedFiles()).length, 1)
    assert.equal(await prisma.upload.count(), 1)

    // And the object is still in the bucket. Nothing in trashUpload touches
    // storage, which is what makes a restore a database write.
    const row = await prisma.upload.findUniqueOrThrow({ where: { id: file.id } })
    assert.equal(row.storageKey, file.storageKey)
  })

  it('records who did it, on the row and in the log', async () => {
    const { abbie, file } = await setup()

    await trashUpload(abbie, file.id)

    const row = await prisma.upload.findUniqueOrThrow({ where: { id: file.id } })
    assert.equal(row.deletedById, abbie.id)

    const logged = await prisma.auditEvent.findFirstOrThrow({
      where: { action: AuditAction.FILE_DELETED, subjectId: file.id },
    })
    assert.match(logged.summary, /Abbie Tigges/)
    assert.match(logged.summary, /IMG_4821\.jpg/)
  })
})

describe('putting a file back', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('returns it to the project', async () => {
    const { abbie, davina, project, file } = await setup()

    await trashUpload(abbie, file.id)
    await restoreFile(davina, file.id)

    assert.equal((await uploadsForProject(project.id)).length, 1)
    assert.equal((await trashedFiles()).length, 0)

    const row = await prisma.upload.findUniqueOrThrow({ where: { id: file.id } })
    assert.equal(row.deletedAt, null)
    assert.equal(row.deletedById, null)
  })

  it('works on something older than the 30 days', async () => {
    const { abbie, davina, project, file } = await setup()

    await trashUpload(abbie, file.id)
    await prisma.upload.update({
      where: { id: file.id },
      data: { deletedAt: new Date(Date.now() - (TRASH_DAYS + 90) * 86_400_000) },
    })

    // The window is about what is shown first, not about what is possible.
    // Refusing to restore something demonstrably still there would be a
    // strange kind of unhelpful.
    await restoreFile(davina, file.id)
    assert.equal((await uploadsForProject(project.id)).length, 1)
  })

  it('does nothing to a file that was never removed', async () => {
    const { davina, project, file } = await setup()

    await restoreFile(davina, file.id)
    assert.equal((await uploadsForProject(project.id)).length, 1)
  })
})

describe('a message taken back', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('can be put back on the thread', async () => {
    const { abbie, davina, project } = await setup()
    const message = await postMessage(abbie, project, 'said in haste')

    await deleteMessage(abbie, message.id, project.id)
    assert.equal((await trashedMessages()).length, 1)

    await restoreMessage(davina, message.id)

    const thread = await messagesForProject(project.id)
    assert.equal(thread.length, 1)
    assert.equal(thread[0].body, 'said in haste')
  })
})

describe('what the trash counts', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('is nothing when nothing has been removed', async () => {
    await setup()
    assert.equal(await trashCount(), 0)
  })

  it('is files and messages together', async () => {
    const { abbie, project, file } = await setup()
    const message = await postMessage(abbie, project, 'a message')

    await trashUpload(abbie, file.id)
    await deleteMessage(abbie, message.id, project.id)

    assert.equal(await trashCount(), 2)
  })
})
