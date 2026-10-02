import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { OptionSlot } from '@prisma/client'
import { APPROVAL_STATEMENT, signRoomApproval, UnchosenItemsError } from '../lib/approvals'
import { chooseOption, setOptions } from '../lib/selections'
import { fixture, option, prisma, reset } from './helpers'

/**
 * Rule 3: an approval snapshots price at signing rather than referencing a
 * live value. The test is the one that matters in practice: move the price
 * after signing and check the record does not move with it.
 */
describe('approvals freeze the price at signing', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('does not follow a price that changes after signing', async () => {
    const { room, selection, user } = await fixture()
    await setOptions(selection.id, [option('Sofa one', 120_000), option('Sofa two', 180_000)])
    await chooseOption(selection.id, OptionSlot.A)

    const approval = await signRoomApproval({
      roomId: room.id,
      userId: user.id,
      signedByName: 'Abbie Grossman',
    })

    assert.equal(approval.lines.length, 1)
    assert.equal(approval.lines[0].unitPriceCents, 120_000)
    assert.equal(approval.furnishingTotalCents, 120_000)

    // The vendor raises the price between approval and order, which is exactly
    // what the December tariff and January price-list reset are about.
    await prisma.selectionOption.updateMany({
      where: { selectionId: selection.id, slot: OptionSlot.A },
      data: { priceCents: 150_000 },
    })

    const reread = await prisma.approval.findUniqueOrThrow({
      where: { id: approval.id },
      include: { lines: true },
    })

    assert.equal(reread.lines[0].unitPriceCents, 120_000, 'the signed record must not move with the live price')
    assert.equal(reread.furnishingTotalCents, 120_000)

    const live = await prisma.selectionOption.findFirstOrThrow({
      where: { selectionId: selection.id, slot: OptionSlot.A },
    })
    assert.equal(live.priceCents, 150_000, 'the live price did change, so the test is meaningful')
  })

  it('multiplies by quantity and records the statement shown', async () => {
    const { room, selection, user } = await fixture()
    await prisma.selection.update({ where: { id: selection.id }, data: { qty: 8 } })
    await setOptions(selection.id, [option('Chair', 13_000)])
    await chooseOption(selection.id, OptionSlot.A)

    const approval = await signRoomApproval({ roomId: room.id, userId: user.id, signedByName: 'Abbie Grossman' })

    assert.equal(approval.lines[0].lineTotalCents, 104_000)
    assert.equal(approval.statementShown, APPROVAL_STATEMENT)
    assert.match(approval.statementShown, /cannot be returned/)
  })

  it('carries the non returnable flag onto the record', async () => {
    const { room, selection, user } = await fixture()
    await setOptions(selection.id, [{ ...option('Custom sofa', 220_000), nonReturnable: true }])
    await chooseOption(selection.id, OptionSlot.A)

    const approval = await signRoomApproval({ roomId: room.id, userId: user.id, signedByName: 'Abbie Grossman' })

    assert.equal(approval.includedNonReturnable, true)
    assert.equal(approval.lines[0].nonReturnable, true)
  })

  it('refuses to sign a room with an unpicked item', async () => {
    const { room, selection, user } = await fixture()
    await setOptions(selection.id, [option('Sofa', 120_000)])
    await chooseOption(selection.id, OptionSlot.A)

    await prisma.selection.create({
      data: { roomId: room.id, ref: `UNPICKED-${Date.now()}`, name: 'Coffee table', category: 'Tables' },
    })

    await assert.rejects(
      () => signRoomApproval({ roomId: room.id, userId: user.id, signedByName: 'Abbie Grossman' }),
      UnchosenItemsError,
    )

    assert.equal(await prisma.approval.count({ where: { roomId: room.id } }), 0)
  })

  it('commits the snapshot amount to the budget, not the live price', async () => {
    const { room, selection, user } = await fixture()
    await setOptions(selection.id, [option('Sofa', 120_000)])
    await chooseOption(selection.id, OptionSlot.A)
    await signRoomApproval({ roomId: room.id, userId: user.id, signedByName: 'Abbie Grossman' })

    await prisma.selectionOption.updateMany({
      where: { selectionId: selection.id },
      data: { priceCents: 999_000 },
    })

    const committed = await prisma.budgetLine.findFirstOrThrow({ where: { roomId: room.id, state: 'COMMITTED' } })
    assert.equal(committed.amountCents, 120_000)
    assert.equal(committed.type, 'FURNISHING')
  })
})
