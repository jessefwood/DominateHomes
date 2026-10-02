import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { BudgetState, BudgetType } from '@prisma/client'
import { budgetTotals } from '../lib/budget'
import { fixture, planExpense, planFurnishing, prisma, reset } from './helpers'

/**
 * Rule 2: the designer's expenses and the furnishing spend are two totals that
 * never blend. The test that matters is that moving money on one side leaves
 * the other side untouched.
 */
describe('furnishing and expense never blend', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('keeps the two sides apart', async () => {
    const { project } = await fixture()
    await planFurnishing(project.id, 3_650_000)
    await planExpense(project.id, 500_000)

    const totals = await budgetTotals(project.id)

    assert.equal(totals.furnishing.plannedCents, 3_650_000)
    assert.equal(totals.expense.plannedCents, 500_000)
  })

  it('an expense never moves the furnishing total', async () => {
    const { project } = await fixture()
    await planFurnishing(project.id, 3_650_000)

    const before = await budgetTotals(project.id)
    await planExpense(project.id, 1_200_000)
    const after = await budgetTotals(project.id)

    assert.equal(after.furnishing.plannedCents, before.furnishing.plannedCents)
    assert.equal(after.expense.plannedCents, 1_200_000)
  })

  it('tracks planned, committed and spent separately on each side', async () => {
    const { project } = await fixture()
    await planFurnishing(project.id, 1_000_000)

    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        type: BudgetType.FURNISHING,
        state: BudgetState.COMMITTED,
        label: 'Sofa',
        amountCents: 300_000,
      },
    })
    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        type: BudgetType.FURNISHING,
        state: BudgetState.SPENT,
        label: 'Rug',
        amountCents: 100_000,
      },
    })

    const totals = await budgetTotals(project.id)

    assert.equal(totals.furnishing.plannedCents, 1_000_000)
    assert.equal(totals.furnishing.committedCents, 300_000)
    assert.equal(totals.furnishing.spentCents, 100_000)
    assert.equal(totals.furnishing.remainingCents, 600_000)
    assert.equal(totals.expense.plannedCents, 0)
  })

  it('exposes no combined total', async () => {
    const { project } = await fixture()
    await planFurnishing(project.id, 100)
    await planExpense(project.id, 200)

    const totals = await budgetTotals(project.id)

    // The shape of the return value is the guarantee. If someone adds a
    // combined field later, this test tells them they changed a client rule.
    assert.deepEqual(Object.keys(totals).sort(), ['expense', 'furnishing'])
  })

  it('refuses a budget line with no type', async () => {
    const { project } = await fixture()

    await assert.rejects(() =>
      prisma.budgetLine.create({
        // `type` has no default, so a line cannot be written without declaring
        // which side of the wall it belongs on.
        data: { projectId: project.id, state: BudgetState.PLANNED, label: 'Untyped', amountCents: 100 } as never,
      }),
    )
  })
})
