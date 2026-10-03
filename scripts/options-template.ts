/**
 * Writes a spreadsheet for Davina to fill in with the three options per item.
 *
 * At one project a year, building an admin screen to type fifty items times
 * three options into a browser is a lot of software for a job done once. A
 * spreadsheet is the tool she already uses, and the importer reads it back.
 *
 *   npm run options:template
 *
 * Produces options.csv with every item in the project, three rows each, the
 * planning band in a comment column so she knows what the room was planned
 * against. Fill in the columns, save as CSV, then run npm run options:import.
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { formatBand } from '../lib/money'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const HEADER = [
  'ref',
  'option',
  'label',
  'vendor',
  'price',
  'lead_days',
  'dimensions',
  'product_url',
  'colorway',
  'non_returnable',
  'ITEM (do not edit)',
  'ROOM (do not edit)',
  'BUDGETED (do not edit)',
]

function cell(value: string | null | undefined): string {
  const text = value ?? ''
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function main() {
  const selections = await prisma.selection.findMany({
    orderBy: [{ room: { order: 'asc' } }, { ref: 'asc' }],
    include: { room: { select: { name: true } }, options: true },
  })

  const rows: string[] = [HEADER.join(',')]

  for (const selection of selections) {
    const band =
      selection.plannedLowCents && selection.plannedHighCents
        ? formatBand(selection.plannedLowCents, selection.plannedHighCents)
        : ''

    for (const slot of ['A', 'B', 'C'] as const) {
      const existing = selection.options.find((option) => option.slot === slot)
      rows.push(
        [
          cell(selection.ref),
          slot,
          cell(existing?.label),
          cell(existing?.vendor),
          existing ? String(existing.priceCents / 100) : '',
          existing?.leadTimeDays ? String(existing.leadTimeDays) : '',
          cell(existing?.dimensions),
          cell(existing?.productUrl),
          cell(existing?.colorway),
          existing?.nonReturnable ? 'yes' : '',
          cell(selection.name),
          cell(selection.room.name),
          cell(band),
        ].join(','),
      )
    }
  }

  writeFileSync('options.csv', rows.join('\n') + '\n')

  console.log(`Wrote options.csv with ${selections.length} items, ${selections.length * 3} rows.`)
  console.log('Fill in label, vendor and price for the options you have. Leave a row blank to skip it.')
  console.log('Then run: npm run options:import')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
