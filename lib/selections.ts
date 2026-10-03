import { OptionSlot, SelectionStatus } from '@prisma/client'
import { prisma } from './db'

/**
 * RULE 1 LIVES HERE, as the second and third of three layers.
 *
 *   1. Postgres: OptionSlot has exactly three values and
 *      @@unique([selectionId, slot]) allows one row each. A fourth option is
 *      rejected by the database whatever the caller does.
 *   2. TypeScript: `OptionSet` below is a tuple union capped at three, so a
 *      fourth entry is a compile error before anything runs.
 *   3. This module: the only write path for options, which refuses a fourth
 *      with a readable message instead of a constraint-violation stack trace.
 *
 * Her previous decorator had the same rule and she said three was hard enough.
 * The rule is not a preference to be relaxed under pressure.
 */

/** The three slots, in presentation order. There is no fourth. */
export const OPTION_SLOTS = [OptionSlot.A, OptionSlot.B, OptionSlot.C] as const

export const MAX_OPTIONS_PER_ITEM = 3

export type OptionDraft = {
  label: string
  vendor: string
  priceCents: number
  leadTimeDays?: number | null
  dimensions?: string | null
  photoUrl?: string | null
  productUrl?: string | null
  colorway?: string | null
  nonReturnable?: boolean
  pricedLive?: boolean
}

/**
 * One, two or three options. Not four. A four-element array literal passed
 * here does not compile, which is the point.
 */
export type OptionSet =
  | [OptionDraft]
  | [OptionDraft, OptionDraft]
  | [OptionDraft, OptionDraft, OptionDraft]

export class TooManyOptionsError extends Error {
  constructor(attempted: number) {
    super(
      `An item can have at most ${MAX_OPTIONS_PER_ITEM} options. ` +
        `This one was given ${attempted}. Replace one of the three instead of adding a fourth.`,
    )
    this.name = 'TooManyOptionsError'
  }
}

/**
 * Replaces an item's options with the given set. Replacing rather than
 * appending is deliberate: it is the only sane way to work inside a hard cap
 * of three, and it keeps the designer honest about swapping an option out
 * rather than quietly growing the list.
 *
 * Returns the stored options in slot order.
 */
export async function setOptions(selectionId: string, options: OptionSet) {
  if (options.length > MAX_OPTIONS_PER_ITEM) {
    // Unreachable through the type, reachable through `as` or plain JS.
    throw new TooManyOptionsError(options.length)
  }

  return prisma.$transaction(async (tx) => {
    // Clear the choice first. The chosen-option foreign key is RESTRICT, so a
    // chosen row cannot be deleted out from under a live decision.
    await tx.selection.update({
      where: { id: selectionId },
      data: { chosenSlot: null, chosenAt: null, status: SelectionStatus.PENDING },
    })

    await tx.selectionOption.deleteMany({ where: { selectionId } })

    await tx.selectionOption.createMany({
      data: options.map((option, index) => ({
        selectionId,
        slot: OPTION_SLOTS[index],
        label: option.label,
        vendor: option.vendor,
        priceCents: option.priceCents,
        leadTimeDays: option.leadTimeDays ?? null,
        dimensions: option.dimensions ?? null,
        photoUrl: option.photoUrl ?? null,
        productUrl: option.productUrl ?? null,
        colorway: option.colorway ?? null,
        nonReturnable: option.nonReturnable ?? false,
        pricedLive: option.pricedLive ?? false,
      })),
    })

    return tx.selectionOption.findMany({
      where: { selectionId },
      orderBy: { slot: 'asc' },
    })
  })
}

/**
 * Adds one option into the first free slot. Throws if all three are taken.
 * Prefer `setOptions` when loading a whole item.
 */
export async function addOption(selectionId: string, option: OptionDraft) {
  const taken = await prisma.selectionOption.findMany({
    where: { selectionId },
    select: { slot: true },
  })

  const free = OPTION_SLOTS.find((slot) => !taken.some((row) => row.slot === slot))

  if (!free) {
    throw new TooManyOptionsError(taken.length + 1)
  }

  return prisma.selectionOption.create({
    data: {
      selectionId,
      slot: free,
      label: option.label,
      vendor: option.vendor,
      priceCents: option.priceCents,
      leadTimeDays: option.leadTimeDays ?? null,
      dimensions: option.dimensions ?? null,
      photoUrl: option.photoUrl ?? null,
      productUrl: option.productUrl ?? null,
      colorway: option.colorway ?? null,
      nonReturnable: option.nonReturnable ?? false,
      pricedLive: option.pricedLive ?? false,
    },
  })
}

/** Statuses past the point where a pick can still be changed. */
const LOCKED_STATUSES: SelectionStatus[] = [
  SelectionStatus.APPROVED,
  SelectionStatus.ORDERED,
  SelectionStatus.RECEIVED,
]

export class SelectionLockedError extends Error {
  constructor(name: string, status: SelectionStatus) {
    super(
      `${name} cannot be changed because it is already ${status.toLowerCase()}. ` +
        'Approved items are signed off at a fixed price and ordered against that record. ' +
        'Ask Davina if something needs to change.',
    )
    this.name = 'SelectionLockedError'
  }
}

async function assertChangeable(selectionId: string) {
  const selection = await prisma.selection.findUniqueOrThrow({
    where: { id: selectionId },
    select: { name: true, status: true },
  })

  if (LOCKED_STATUSES.includes(selection.status)) {
    throw new SelectionLockedError(selection.name, selection.status)
  }
}

/**
 * Records her pick. The composite foreign key on Selection means the slot must
 * belong to this item's own options, so this cannot store a choice that points
 * at some other item's row.
 *
 * Choosing is not approving. Status moves to CHOSEN, and nothing orders until
 * the room is signed off on the approvals screen. Once it is signed off the
 * pick locks, because the approval snapshotted a price against that exact
 * option and changing it underneath would make the record a lie.
 */
export async function chooseOption(selectionId: string, slot: OptionSlot) {
  await assertChangeable(selectionId)

  return prisma.selection.update({
    where: { id: selectionId },
    data: { chosenSlot: slot, chosenAt: new Date(), status: SelectionStatus.CHOSEN },
    include: { chosenOption: true },
  })
}

/** Clears a pick so she can change her mind, up until the room is approved. */
export async function clearChoice(selectionId: string) {
  await assertChangeable(selectionId)

  return prisma.selection.update({
    where: { id: selectionId },
    data: { chosenSlot: null, chosenAt: null, status: SelectionStatus.PENDING },
  })
}

export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  PENDING: 'Waiting on you',
  CHOSEN: 'Picked',
  APPROVED: 'Approved',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
}
