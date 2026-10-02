import { BudgetState, BudgetType, type BudgetLine } from '@prisma/client'
import { prisma } from './db'

/**
 * RULE 2 LIVES HERE.
 *
 * Abbie asked directly for the designer's expenses to be broken out from the
 * furnishing spend. Two distinct totals, always visible, never blended.
 *
 * So this module has no function that returns a single combined number, and it
 * never will. `BudgetTotals` has no `total` field on purpose. If a screen needs
 * one number, that is a conversation with the client, not a helper added here.
 *
 * Every read goes through `budgetTotals()`, which groups by type at the
 * database and hands back the two sides separately.
 */

export type SideTotals = {
  /** What the plan allocates. */
  plannedCents: number
  /** Approved and promised to a vendor, not yet paid. */
  committedCents: number
  /** Money that has left. */
  spentCents: number
  /** planned - (committed + spent). Negative means over the allocation. */
  remainingCents: number
}

export type BudgetTotals = {
  furnishing: SideTotals
  expense: SideTotals
}

const emptySide = (): SideTotals => ({
  plannedCents: 0,
  committedCents: 0,
  spentCents: 0,
  remainingCents: 0,
})

function applyState(side: SideTotals, state: BudgetState, amountCents: number) {
  if (state === BudgetState.PLANNED) side.plannedCents += amountCents
  if (state === BudgetState.COMMITTED) side.committedCents += amountCents
  if (state === BudgetState.SPENT) side.spentCents += amountCents
}

function finalise(side: SideTotals): SideTotals {
  side.remainingCents = side.plannedCents - (side.committedCents + side.spentCents)
  return side
}

/** Totals for a whole project, split by type. Never summed across types. */
export async function budgetTotals(projectId: string): Promise<BudgetTotals> {
  const rows = await prisma.budgetLine.groupBy({
    by: ['type', 'state'],
    where: { projectId },
    _sum: { amountCents: true },
  })

  const totals: BudgetTotals = { furnishing: emptySide(), expense: emptySide() }

  for (const row of rows) {
    const side = row.type === BudgetType.FURNISHING ? totals.furnishing : totals.expense
    applyState(side, row.state, row._sum.amountCents ?? 0)
  }

  finalise(totals.furnishing)
  finalise(totals.expense)
  return totals
}

/** The same split, computed from lines already in hand. */
export function totalsFromLines(lines: Pick<BudgetLine, 'type' | 'state' | 'amountCents'>[]): BudgetTotals {
  const totals: BudgetTotals = { furnishing: emptySide(), expense: emptySide() }

  for (const line of lines) {
    const side = line.type === BudgetType.FURNISHING ? totals.furnishing : totals.expense
    applyState(side, line.state, line.amountCents)
  }

  finalise(totals.furnishing)
  finalise(totals.expense)
  return totals
}

/** Committed plus spent on one side. What is actually consumed. */
export function consumedCents(side: SideTotals): number {
  return side.committedCents + side.spentCents
}

export const BUDGET_TYPE_LABEL: Record<BudgetType, string> = {
  FURNISHING: 'Furnishings',
  EXPENSE: "Davina's expenses",
}
