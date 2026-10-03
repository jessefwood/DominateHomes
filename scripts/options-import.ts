/**
 * Reads options.csv back in and loads the options onto each item.
 *
 *   npm run options:import           check the file and report, change nothing
 *   npm run options:import -- --write  actually write it
 *
 * Dry run by default. Loading selections is the one job where a typo is
 * expensive, so the default is to tell you what it would do.
 *
 * A row with no label is skipped, so a partly filled sheet is fine: load what
 * is ready and come back for the rest. Importing an item replaces that item's
 * options rather than adding to them, which is the only sane behaviour inside
 * a hard cap of three.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { MAX_OPTIONS_PER_ITEM, setOptions, type OptionDraft, type OptionSet } from '../lib/selections'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const WRITE = process.argv.includes('--write')
const FILE = process.argv.find((arg) => arg.endsWith('.csv')) ?? 'options.csv'

/** Minimal CSV reader: handles quoted fields, doubled quotes and commas inside them. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

function money(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const amount = Number(cleaned)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

async function main() {
  const rows = parseCsv(readFileSync(FILE, 'utf8'))
  const [header, ...body] = rows

  if (!header) throw new Error(`${FILE} is empty.`)

  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const idx = {
    ref: col('ref'),
    option: col('option'),
    label: col('label'),
    vendor: col('vendor'),
    price: col('price'),
    lead: col('lead_days'),
    dimensions: col('dimensions'),
    url: col('product_url'),
    colorway: col('colorway'),
    nonReturnable: col('non_returnable'),
  }

  for (const [name, position] of Object.entries(idx)) {
    if (position === -1) throw new Error(`${FILE} is missing the "${name}" column.`)
  }

  const byRef = new Map<string, OptionDraft[]>()
  const problems: string[] = []

  for (const [line, row] of body.entries()) {
    const at = `row ${line + 2}`
    const ref = (row[idx.ref] ?? '').trim()
    const label = (row[idx.label] ?? '').trim()

    if (!ref) continue
    if (!label) continue // Not filled in yet. Fine.

    const vendor = (row[idx.vendor] ?? '').trim()
    const priceCents = money(row[idx.price] ?? '')

    if (!vendor) problems.push(`${at} (${ref}): has a label but no vendor.`)
    if (priceCents === null) problems.push(`${at} (${ref}): price is missing or not a number.`)
    if (!vendor || priceCents === null) continue

    const leadRaw = (row[idx.lead] ?? '').trim()
    const lead = leadRaw ? Number(leadRaw) : null

    if (leadRaw && !Number.isFinite(lead)) {
      problems.push(`${at} (${ref}): lead_days "${leadRaw}" is not a number.`)
      continue
    }

    const drafts = byRef.get(ref) ?? []
    drafts.push({
      label,
      vendor,
      priceCents,
      leadTimeDays: lead,
      dimensions: (row[idx.dimensions] ?? '').trim() || null,
      productUrl: (row[idx.url] ?? '').trim() || null,
      colorway: (row[idx.colorway] ?? '').trim() || null,
      nonReturnable: /^(y|yes|true|1)$/i.test((row[idx.nonReturnable] ?? '').trim()),
      pricedLive: true,
    })
    byRef.set(ref, drafts)
  }

  // The three-option rule, caught here with a readable message rather than
  // surfacing as a database constraint violation later.
  for (const [ref, drafts] of byRef) {
    if (drafts.length > MAX_OPTIONS_PER_ITEM) {
      problems.push(
        `${ref}: ${drafts.length} options. The limit is ${MAX_OPTIONS_PER_ITEM}. ` +
          'Replace one rather than adding a fourth.',
      )
    }
  }

  const known = await prisma.selection.findMany({ select: { id: true, ref: true, name: true } })
  const refToSelection = new Map(known.map((selection) => [selection.ref, selection]))

  for (const ref of byRef.keys()) {
    if (!refToSelection.has(ref)) {
      problems.push(`${ref}: no item with that reference. Check the ref column against the template.`)
    }
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s) in ${FILE}. Nothing was written.\n`)
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('')
    process.exit(1)
  }

  if (byRef.size === 0) {
    console.log(`No filled-in options found in ${FILE}. Add a label, vendor and price to a row.`)
    return
  }

  console.log(`\n${WRITE ? 'Importing' : 'Dry run'}: ${byRef.size} item(s) from ${FILE}\n`)

  for (const [ref, drafts] of byRef) {
    const selection = refToSelection.get(ref)!
    const summary = drafts.map((d) => `${d.label} (${d.vendor}, $${d.priceCents / 100})`).join('; ')
    console.log(`  ${ref}  ${selection.name}`)
    console.log(`      ${drafts.length} option(s): ${summary}`)

    if (WRITE) {
      await setOptions(selection.id, drafts as OptionSet)
    }
  }

  console.log(
    WRITE
      ? `\nDone. ${byRef.size} item(s) updated.\n`
      : '\nNothing was written. Run again with --write to apply.\n',
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
