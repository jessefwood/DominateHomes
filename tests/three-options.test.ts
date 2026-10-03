import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { OptionSlot } from '@prisma/client'
import {
  addOption,
  chooseOption,
  clearChoice,
  SelectionLockedError,
  setOptions,
  TooManyOptionsError,
} from '../lib/selections'
import { fixture, option, prisma, reset } from './helpers'

/**
 * Rule 1: never more than 3 options per item, and a fourth must be impossible
 * in the data model rather than hidden in the UI. These tests go at the
 * database, not the component, because that is where the claim has to hold.
 */
describe('three options per item is structural', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('accepts three options', async () => {
    const { selection } = await fixture()
    const stored = await setOptions(selection.id, [
      option('Sofa one', 120_000),
      option('Sofa two', 180_000),
      option('Sofa three', 240_000),
    ])

    assert.equal(stored.length, 3)
    assert.deepEqual(
      stored.map((row) => row.slot),
      [OptionSlot.A, OptionSlot.B, OptionSlot.C],
    )
  })

  it('refuses a fourth option through the write path', async () => {
    const { selection } = await fixture()
    await setOptions(selection.id, [option('One', 100), option('Two', 200), option('Three', 300)])

    await assert.rejects(() => addOption(selection.id, option('Four', 400)), TooManyOptionsError)

    assert.equal(await prisma.selectionOption.count({ where: { selectionId: selection.id } }), 3)
  })

  it('refuses a fourth option at the database even when the write path is bypassed', async () => {
    const { selection } = await fixture()
    await setOptions(selection.id, [option('One', 100), option('Two', 200), option('Three', 300)])

    // Going straight at the table, the way a stray script or a future endpoint
    // would. The unique constraint is what stops it.
    await assert.rejects(() =>
      prisma.selectionOption.create({
        data: { selectionId: selection.id, slot: OptionSlot.A, label: 'Four', vendor: 'V', priceCents: 400 },
      }),
    )

    // And there is no fourth slot to use instead. The enum has three values,
    // so this does not even typecheck without the cast, and it fails at the
    // database with the cast.
    await assert.rejects(() =>
      prisma.selectionOption.create({
        data: {
          selectionId: selection.id,
          slot: 'D' as unknown as OptionSlot,
          label: 'Four',
          vendor: 'V',
          priceCents: 400,
        },
      }),
    )

    assert.equal(await prisma.selectionOption.count({ where: { selectionId: selection.id } }), 3)
  })

  it('cannot choose an option belonging to a different item', async () => {
    const { selection, room } = await fixture()
    await setOptions(selection.id, [option('One', 100)])

    const other = await prisma.selection.create({
      data: { roomId: room.id, ref: `OTHER-${Date.now()}`, name: 'Chair', category: 'Seating' },
    })

    // `other` has no options at all, so slot A does not exist for it.
    await assert.rejects(() => chooseOption(other.id, OptionSlot.A))
  })

  it('cannot delete the option a choice points at', async () => {
    const { selection } = await fixture()
    const [first] = await setOptions(selection.id, [option('One', 100), option('Two', 200)])
    await chooseOption(selection.id, OptionSlot.A)

    await assert.rejects(() => prisma.selectionOption.delete({ where: { id: first.id } }))
  })

  it('replacing the option set clears a stale choice', async () => {
    const { selection } = await fixture()
    await setOptions(selection.id, [option('One', 100), option('Two', 200), option('Three', 300)])
    await chooseOption(selection.id, OptionSlot.B)

    await setOptions(selection.id, [option('New one', 900), option('New two', 950)])

    const after = await prisma.selection.findUniqueOrThrow({ where: { id: selection.id } })
    assert.equal(after.chosenSlot, null)
    assert.equal(after.status, 'PENDING')
  })

  it('locks a pick once the room is approved', async () => {
    const { selection } = await fixture()
    await setOptions(selection.id, [option('One', 100), option('Two', 200)])
    await chooseOption(selection.id, OptionSlot.A)

    // Approving snapshots a price against this exact option. Letting the pick
    // change afterwards would make the signed record describe something she
    // did not agree to.
    await prisma.selection.update({ where: { id: selection.id }, data: { status: 'APPROVED' } })

    await assert.rejects(() => chooseOption(selection.id, OptionSlot.B), SelectionLockedError)
    await assert.rejects(() => clearChoice(selection.id), SelectionLockedError)

    const after = await prisma.selection.findUniqueOrThrow({ where: { id: selection.id } })
    assert.equal(after.chosenSlot, OptionSlot.A)
  })

  it('still allows a change before approval', async () => {
    const { selection } = await fixture()
    await setOptions(selection.id, [option('One', 100), option('Two', 200)])
    await chooseOption(selection.id, OptionSlot.A)
    await chooseOption(selection.id, OptionSlot.B)

    const after = await prisma.selection.findUniqueOrThrow({ where: { id: selection.id } })
    assert.equal(after.chosenSlot, OptionSlot.B)
  })
})
