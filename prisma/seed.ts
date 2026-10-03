/**
 * Seeds the portal from the two source files in docs/.
 *
 * Everything here traces to a line in those documents. Where a number is a
 * planning band rather than a quote it is stored as a band and labelled as
 * one. Where the source does not say, the field is left null rather than
 * filled with a plausible guess. Assumptions that had to be made are marked
 * ASSUMPTION so they can be checked.
 */
import {
  ArtDecision,
  BudgetState,
  BudgetType,
  KeepStatus,
  OpenItemOwner,
  Phase,
  PrismaClient,
  ReframeStatus,
  Role,
  RoomTier,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const d = (amount: number) => Math.round(amount * 100)

/**
 * Refuses to run if the database already holds real client decisions.
 *
 * The seed wipes every table and rebuilds from the source documents. That is
 * correct exactly once, on an empty database. Run it again after the client
 * has picked options, signed off a room or answered a question and that work
 * is gone, with no undo.
 *
 * A warning in a document only holds while everyone remembers it, and the
 * people running this are not necessarily the people who wrote it. So the
 * check lives here. Re-seeding a database that nobody has touched yet is
 * still allowed, because that is harmless and useful while building.
 *
 * FORCE_SEED=yes overrides it. That exists for a deliberate reset, not for
 * getting past a refusal you did not expect. If this refuses and you were not
 * intending to destroy client decisions, stop and ask.
 */
async function assertSafeToSeed() {
  const [approvals, chosen, orders, answered] = await Promise.all([
    prisma.approval.count(),
    prisma.selection.count({ where: { chosenSlot: { not: null } } }),
    prisma.purchaseOrder.count(),
    prisma.openItem.count({ where: { answer: { not: null } } }),
  ])

  const decisions = approvals + chosen + orders + answered
  if (decisions === 0) return

  if (process.env.FORCE_SEED === 'yes') {
    console.warn(
      `\nFORCE_SEED is set. Destroying ${decisions} client decision(s): ` +
        `${approvals} approval(s), ${chosen} chosen item(s), ${orders} order(s), ` +
        `${answered} answered question(s).\n`,
    )
    return
  }

  throw new Error(
    `Refusing to seed. This database holds ${decisions} real client decision(s): ` +
      `${approvals} approval(s), ${chosen} chosen item(s), ${orders} order(s), ` +
      `${answered} answered question(s).\n\n` +
      'Seeding wipes every table and there is no undo. If you are seeing this, ' +
      'the database has already been set up and does not need seeding again.\n\n' +
      'If you genuinely mean to erase the project and start over, run it again ' +
      'with FORCE_SEED=yes.',
  )
}

async function main() {
  await assertSafeToSeed()

  // Order matters only for foreign keys; everything else is idempotent via
  // deleteMany so the seed can be re-run while the portal is being built.
  //
  // Choices are cleared first because the chosen-option foreign key is
  // RESTRICT: an option that a decision points at cannot be deleted.
  await prisma.selection.updateMany({ data: { chosenSlot: null, chosenAt: null } })

  await prisma.$transaction([
    prisma.projectMember.deleteMany(),
    prisma.approvalLine.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.budgetLine.deleteMany(),
    prisma.selectionOption.deleteMany(),
    prisma.selection.deleteMany(),
    prisma.artPiece.deleteMany(),
    prisma.reusePiece.deleteMany(),
    prisma.openItem.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.room.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ])

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------
  const abbie = await prisma.user.create({
    data: {
      // Sign-in links go to this address, so it has to be right.
      email: 'abbieg323@gmail.com',
      name: 'Abbie Grossman',
      role: Role.CLIENT,
      // Deliberately closed. The pricing proposal and the design services
      // agreement both have to exist before Abbie is let in, and that is
      // Davina's call to make. Flip this to true when she says so. Until then
      // asking for a link does nothing, even if someone has the URL.
      signInEnabled: false,
    },
  })

  // Both designers can sign in. Role.DESIGNER is what an admin surface will
  // key off once there is one; today it mainly means these two are not the
  // client.
  const davina = await prisma.user.create({
    data: {
      email: 'realestate@davinahughes.com',
      name: 'Davina Hughes',
      role: Role.DESIGNER,
    },
  })

  const jesse = await prisma.user.create({
    data: {
      email: 'jesse@dominatemoney.com',
      name: 'Jesse Wood',
      role: Role.DESIGNER,
    },
  })

  // -------------------------------------------------------------------------
  // Project
  // -------------------------------------------------------------------------
  const project = await prisma.project.create({
    data: {
      slug: '643-bianca',
      // The project's name, used everywhere including client facing. GL Homes
      // still has not issued a street address, so addressLine stays null: this
      // name is what the project is called, not a claim about its postal
      // address. Set addressLine when GL assigns the lot number.
      displayName: '643 Bianca',
      addressLine: null,
      community: 'Valencia Parc at Riverland, Port St. Lucie, FL',
      planName: 'GL Homes, Plan 643 Bianca, Vintage Collection',
      acSqFt: 2799,
      totalSqFt: 3599,
      phase: Phase.SELECTIONS,
      clientName: 'Abbie Grossman',
      designer: 'Davina Hughes, Dominate Homes',
      allocationCents: d(47_000),
      earliestCloseOn: new Date('2027-04-01T00:00:00Z'),
      installAfterOn: new Date('2027-04-01T00:00:00Z'),
    },
  })

  // Abbie can see this project. Designers are not listed: they see every
  // project by role, so a row per designer per project would be bookkeeping
  // that only ever goes out of date.
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: abbie.id, label: 'Abbie and Russell' },
  })

  // -------------------------------------------------------------------------
  // Rooms
  //
  // budgetLow is the low end of the budget-smart band, budgetMid is the mid
  // tier planning number, budgetHigh is the high end of the step-up band. That
  // keeps the full honest span plus the number the project is planned against.
  // -------------------------------------------------------------------------
  type RoomSeed = {
    name: string
    slug: string
    widthFt: number | null
    lengthFt: number | null
    tier: RoomTier
    rugSize: string | null
    contents: string
    constraintNote?: string
    unresolvedNote?: string
    low: number
    mid: number
    high: number
  }

  const roomSeeds: RoomSeed[] = [
    {
      name: 'Great Room',
      slug: 'great-room',
      widthFt: 18,
      lengthFt: 19,
      tier: RoomTier.MAJOR,
      rugSize: '10 by 14, 9 by 12 minimum',
      contents: 'Sofa up to 96 inches, 2 chairs, coffee table, 2 side tables, pair of lamps',
      constraintNote:
        'Nearly square with openings on three sides. One 10 by 14 rug holding a floating group. Do not push the furniture to the walls.',
      unresolvedNote:
        'The TV wall is not settled. Abbie thought the plan might be flipped from what Davina drew, and the doors near the club room entry limit where a TV can go. We said we would nail this down and it is still open.',
      low: 3_100,
      mid: 3_600,
      high: 10_300,
    },
    {
      name: 'Dining Room',
      slug: 'dining-room',
      widthFt: 15,
      lengthFt: 10,
      tier: RoomTier.MAJOR,
      rugSize: '8 by 10',
      contents: 'Table 84 to 96 inches seating 8, 8 chairs, buffet up to 60 inches, 1 fixture',
      constraintNote:
        'Only 10 feet deep. The narrow top is not a style choice. A 42 inch top leaves about 40 inches behind each chair, so specify 36 to 38 inches.',
      low: 2_840,
      mid: 3_700,
      high: 11_900,
    },
    {
      name: 'Club Room',
      slug: 'club-room',
      widthFt: 15,
      lengthFt: 13,
      tier: RoomTier.MAJOR,
      rugSize: '8 by 10',
      contents: 'Their sofas, TV and stand, coffee table only',
      constraintNote:
        'There is an exterior door to the patio with a barbecue gas outlet beside it, which limits the wall options.',
      low: 1_460,
      mid: 1_900,
      high: 5_550,
    },
    {
      name: 'Primary Suite',
      slug: 'primary-suite',
      widthFt: 15,
      lengthFt: 16,
      tier: RoomTier.MAJOR,
      rugSize: '9 by 12',
      contents: 'King, 2 nightstands, dresser, bench, pair of lamps',
      constraintNote:
        'Worth a second look: the room schedule lists an end of bed bench, and the approved direction has end of bed bench on the hard no list. One of the two needs to change.',
      low: 3_930,
      mid: 5_000,
      high: 15_400,
    },
    {
      name: '2nd Bedroom',
      slug: '2nd-bedroom',
      widthFt: 12,
      lengthFt: 12,
      tier: RoomTier.MAJOR,
      rugSize: '8 by 10',
      contents: "Daughter's white set and bedding, lamp, mattress",
      constraintNote:
        '12 by 12 takes a queen, not a king. A king plus nightstands needs about 124 inches of a 144 inch wall. Confirm the existing bed size before anything is ordered.',
      low: 1_730,
      mid: 2_200,
      high: 6_050,
    },
    {
      name: '3rd Bedroom',
      slug: '3rd-bedroom',
      widthFt: 12,
      lengthFt: 12,
      tier: RoomTier.LIGHT,
      rugSize: '8 by 10',
      contents: 'Queen bed, mattress, 2 nightstands, dresser, 2 lamps, rug, bedding. Bed in a box is fine here.',
      constraintNote: '12 by 12 takes a queen, not a king.',
      low: 2_810,
      mid: 3_600,
      high: 10_700,
    },
    {
      name: 'Screened Patio',
      slug: 'screened-patio',
      widthFt: 20,
      lengthFt: 10,
      tier: RoomTier.MAJOR,
      rugSize: 'Two 5 by 8 outdoor',
      contents: 'Two zones: a lounge group, then a 48 inch round table with 4 chairs',
      constraintNote:
        '20 by 10 is too narrow for one group facing out, so it runs as two zones along the length. Cushion fabric is the whole game here. Solution dyed acrylic is the difference between five years and eighteen months in Florida sun.',
      low: 2_450,
      mid: 3_300,
      high: 11_200,
    },
    {
      name: 'Kitchen',
      slug: 'kitchen',
      widthFt: 15,
      lengthFt: 11,
      tier: RoomTier.LIGHT,
      rugSize: '2.5 by 7 runner',
      contents: 'Counter height stools, runner, accessories',
      constraintNote:
        'The island takes 3 stools comfortably and 4 at a squeeze. You asked for 4, so we need the run length before ordering.',
      low: 620,
      mid: 850,
      high: 2_400,
    },
    {
      name: 'Foyer',
      slug: 'foyer',
      widthFt: 7,
      lengthFt: 15,
      tier: RoomTier.LIGHT,
      rugSize: '3 by 10 runner',
      contents: 'Your console, the ornate mirror above it, lamp, bowl',
      low: 390,
      mid: 550,
      high: 1_500,
    },
    // The four baths are budgeted as a single line of $1,180 to $1,950 low,
    // $1,500 mid, $2,600 to $4,200 step up. Split evenly across the four so
    // each room carries a figure. The totals still add up to the source line.
    {
      name: 'Primary Bath',
      slug: 'primary-bath',
      widthFt: 15,
      lengthFt: 11,
      tier: RoomTier.LIGHT,
      rugSize: 'Two 2 by 3 mats',
      contents: 'Towels, mats',
      constraintNote: 'The four baths are budgeted together. This is an even quarter share of that line.',
      low: 295,
      mid: 375,
      high: 1_050,
    },
    {
      name: '2nd Bath',
      slug: '2nd-bath',
      widthFt: 6,
      lengthFt: 9,
      tier: RoomTier.LIGHT,
      rugSize: 'One mat',
      contents: 'Towels, mirror, shower curtain. This one has a tub.',
      constraintNote: 'The four baths are budgeted together. This is an even quarter share of that line.',
      low: 295,
      mid: 375,
      high: 1_050,
    },
    {
      name: '3rd Bath',
      slug: '3rd-bath',
      widthFt: 8,
      lengthFt: 5,
      tier: RoomTier.LIGHT,
      rugSize: 'One mat',
      contents: 'Towels, mirror, shower curtain. This one has a tub.',
      constraintNote: 'The four baths are budgeted together. This is an even quarter share of that line.',
      low: 295,
      mid: 375,
      high: 1_050,
    },
    {
      name: 'Cabana Bath',
      slug: 'cabana-bath',
      widthFt: null,
      lengthFt: null,
      tier: RoomTier.LIGHT,
      rugSize: 'One mat',
      contents: 'Towels, mirror. Walk in, serves the patio.',
      constraintNote: 'The four baths are budgeted together. This is an even quarter share of that line.',
      low: 295,
      mid: 375,
      high: 1_050,
    },
    {
      name: 'Laundry',
      slug: 'laundry',
      widthFt: 11,
      lengthFt: 6,
      tier: RoomTier.EXCLUDED,
      rugSize: 'Mat',
      contents: 'Leaving this one as is.',
      low: 0,
      mid: 0,
      high: 0,
    },
  ]

  const rooms: Record<string, string> = {}

  for (const [index, seed] of roomSeeds.entries()) {
    const room = await prisma.room.create({
      data: {
        projectId: project.id,
        name: seed.name,
        slug: seed.slug,
        order: index + 1,
        widthFt: seed.widthFt,
        lengthFt: seed.lengthFt,
        tier: seed.tier,
        rugSize: seed.rugSize,
        contents: seed.contents,
        constraintNote: seed.constraintNote ?? null,
        unresolvedNote: seed.unresolvedNote ?? null,
        budgetLowCents: d(seed.low),
        budgetMidCents: d(seed.mid),
        budgetHighCents: d(seed.high),
      },
    })
    rooms[seed.slug] = room.id
  }

  // -------------------------------------------------------------------------
  // Selections: the item list per room, from the line items in the budget.
  //
  // No options are seeded. The three options per item are still owed by
  // Davina, so every item sits at PENDING with empty slots. That is the real
  // state of the project and the portal should show it rather than invent
  // products that nobody has priced.
  // -------------------------------------------------------------------------
  type ItemSeed = [ref: string, name: string, category: string, qty: number, low: number, high: number]

  const itemsByRoom: Record<string, ItemSeed[]> = {
    'great-room': [
      ['GR-SOFA', 'Sofa, 90 to 96 inches, performance fabric', 'Seating', 1, 900, 2_800],
      ['GR-CHAIRS', 'Accent chairs', 'Seating', 2, 600, 1_800],
      ['GR-COFFEE', 'Coffee table, round 48 inch', 'Tables', 1, 250, 900],
      ['GR-SIDE', 'Side tables', 'Tables', 2, 300, 900],
      ['GR-LAMPS', 'Table lamps and a floor lamp', 'Lighting', 3, 280, 1_100],
      ['GR-RUG', 'Rug 10 by 14 with pad', 'Rugs', 1, 620, 2_200],
      ['GR-STYLE', 'Pillows, throw, styling', 'Decor', 1, 150, 600],
    ],
    'dining-room': [
      ['DR-TABLE', 'Table 84 to 96 inches, narrow top 36 to 38 inches deep', 'Tables', 1, 700, 3_000],
      ['DR-CHAIRS', 'Dining chairs', 'Seating', 8, 1_040, 4_000],
      ['DR-BUFFET', 'Buffet, up to 60 inches', 'Case goods', 1, 500, 2_000],
      ['DR-FIXTURE', 'Dining fixture', 'Lighting', 1, 250, 1_400],
      ['DR-RUG', 'Rug 8 by 10, flat weave or washable', 'Rugs', 1, 350, 1_500],
    ],
    'club-room': [
      ['CR-SLIP', 'Slipcovers, washed cotton or linen, flax or oatmeal', 'Upholstery', 2, 280, 900],
      ['CR-CHAIR', 'Accent chair', 'Seating', 1, 350, 1_200],
      ['CR-LAMPS', 'Lamps', 'Lighting', 2, 160, 700],
      ['CR-RUG', 'Rug 8 by 10', 'Rugs', 1, 300, 1_300],
      ['CR-TABLES', 'Side table and ottoman', 'Tables', 2, 250, 1_000],
      ['CR-STYLE', 'Pillows and throws', 'Decor', 1, 120, 450],
    ],
    'primary-suite': [
      ['PS-BED', 'King bed, upholstered', 'Beds', 1, 600, 2_500],
      ['PS-MATTRESS', 'King mattress and foundation', 'Mattresses', 1, 1_050, 3_900],
      ['PS-NIGHT', 'Nightstands', 'Case goods', 2, 400, 1_500],
      ['PS-DRESSER', 'Dresser', 'Case goods', 1, 600, 2_400],
      ['PS-BENCH', 'Bench', 'Seating', 1, 200, 800],
      ['PS-LAMPS', 'Lamps', 'Lighting', 2, 180, 800],
      ['PS-RUG', 'Rug 9 by 12', 'Rugs', 1, 400, 1_700],
      ['PS-BEDDING', 'Bedding, sheets, insert, duvet, quilt, shams, decorative', 'Bedding', 1, 500, 1_800],
    ],
    '2nd-bedroom': [
      ['B2-MATTRESS', 'Mattress and foundation, size to be confirmed', 'Mattresses', 1, 800, 2_600],
      ['B2-NIGHT', 'Second nightstand to make a pair', 'Case goods', 1, 200, 700],
      ['B2-BEDDING', 'Bedding, all new', 'Bedding', 1, 350, 1_100],
      ['B2-LAMP', 'Lamp', 'Lighting', 1, 80, 350],
      ['B2-RUG', 'Rug 8 by 10', 'Rugs', 1, 300, 1_300],
    ],
    '3rd-bedroom': [
      ['B3-BED', 'Queen bed', 'Beds', 1, 400, 1_600],
      ['B3-MATTRESS', 'Mattress and foundation', 'Mattresses', 1, 700, 2_500],
      ['B3-NIGHT', 'Nightstands', 'Case goods', 2, 400, 1_500],
      ['B3-DRESSER', 'Dresser', 'Case goods', 1, 500, 2_000],
      ['B3-LAMPS', 'Lamps', 'Lighting', 2, 160, 700],
      ['B3-RUG', 'Rug 8 by 10', 'Rugs', 1, 300, 1_300],
      ['B3-BEDDING', 'Bedding', 'Bedding', 1, 350, 1_100],
    ],
    'screened-patio': [
      ['PT-LOUNGE', 'Lounge group: loveseat, 2 chairs, coffee table', 'Outdoor', 1, 1_200, 5_500],
      ['PT-DINING', '48 inch round table with 4 chairs', 'Outdoor', 1, 600, 2_600],
      ['PT-RUGS', 'Outdoor rugs, 5 by 8', 'Rugs', 2, 200, 900],
      ['PT-ACCENT', 'Side tables, planters, outdoor pillows', 'Outdoor', 1, 300, 1_200],
      ['PT-LIGHT', 'Lighting or fan, if the builder does not supply it', 'Lighting', 1, 150, 1_000],
      ['PT-TV', 'Outdoor rated TV', 'Electronics', 1, 0, 0],
    ],
    kitchen: [
      ['KI-STOOLS', 'Counter stools, 3 or 4 pending the island run', 'Seating', 4, 240, 560],
      ['KI-RUNNER', 'Runner 2.5 by 7', 'Rugs', 1, 150, 500],
      ['KI-ACCESS', 'Board, canisters, tray, bowl, towels, stems', 'Decor', 1, 120, 280],
    ],
    foyer: [
      ['FO-LAMP', 'Lamp', 'Lighting', 1, 40, 130],
      ['FO-RUNNER', 'Runner 3 by 10', 'Rugs', 1, 200, 700],
      ['FO-STYLE', 'Bowl, tray, stems or plant, basket', 'Decor', 1, 80, 200],
    ],
  }

  for (const [slug, items] of Object.entries(itemsByRoom)) {
    for (const [ref, name, category, qty, low, high] of items) {
      await prisma.selection.create({
        data: {
          roomId: rooms[slug],
          ref,
          name,
          category,
          qty,
          plannedLowCents: low > 0 ? d(low) : null,
          plannedHighCents: high > 0 ? d(high) : null,
          notes:
            ref === 'PT-TV'
              ? 'A third TV, outdoor rated. The covered patio could take a regular unit but hurricanes argue for outdoor or a mounted box. Not priced yet.'
              : null,
        },
      })
    }
  }

  // -------------------------------------------------------------------------
  // Budget
  //
  // Furnishing side carries the real planning numbers. The expense side is
  // seeded with labelled placeholders at zero, because the source documents
  // are explicitly goods only and no designer expense has been quoted yet.
  // Nothing is invented to fill that column.
  // -------------------------------------------------------------------------
  for (const seed of roomSeeds) {
    if (seed.mid === 0) continue
    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        roomId: rooms[seed.slug],
        type: BudgetType.FURNISHING,
        state: BudgetState.PLANNED,
        label: `${seed.name} furnishings`,
        category: 'Room allocation',
        amountCents: d(seed.mid),
        note: 'Mid tier planning band, not a quote.',
      },
    })
  }

  const wholeHouse: [string, string, number, string][] = [
    ['Window treatments', 'Whole house', 5_000, 'Woven wood shades and ready made panels at this tier. Blinds only, no curtains. Your GL Homes contract may already include basic blinds, and if it does this line drops by about half.'],
    ['Art, mirrors and decor', 'Whole house', 5_200, 'Includes reframing three or four existing pieces to black and natural wood.'],
    ['Freight, delivery, assembly, install', 'Logistics', 3_600, 'Runs 8 to 12 percent of goods.'],
    ['Sales tax at 7 percent', 'Tax', 2_800, '6 percent Florida plus 1 percent St. Lucie surtax. The county portion applies to the first $5,000 of any single item.'],
    ['Contingency', 'Contingency', 4_300, '8 to 10 percent. This already covers tariff movement, which is why there is no separate tariff line.'],
  ]

  for (const [label, category, amount, note] of wholeHouse) {
    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        type: BudgetType.FURNISHING,
        state: BudgetState.PLANNED,
        label,
        category,
        amountCents: d(amount),
        note,
      },
    })
  }

  const expensePlaceholders: [string, string][] = [
    ['Design fee', 'Pending the design services agreement. No amount is recorded until that is signed.'],
    ['Pricing proposal', 'Jesse sends this as an invoice for review. Not yet issued.'],
    ['Receiving warehouse, if the house is not ready', 'Only if orders land before the house does. Runs $300 to $800 a month locally. Not committed.'],
  ]

  for (const [label, note] of expensePlaceholders) {
    await prisma.budgetLine.create({
      data: {
        projectId: project.id,
        type: BudgetType.EXPENSE,
        state: BudgetState.PLANNED,
        label,
        category: 'Design services',
        amountCents: 0,
        note,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Her pieces
  // -------------------------------------------------------------------------
  type PieceSeed = {
    no: string | null
    name: string
    dimensions?: string
    confirmed?: boolean
    room?: string
    scenarioDependent?: boolean
    low?: number
    high?: number
    treatment?: string
    description?: string
  }

  const pieces: PieceSeed[] = [
    { no: '01', name: 'Media console, grey wash', dimensions: '48 inches wide', confirmed: true, room: 'club-room', low: 400, high: 700, description: 'Measured at 48 inches, not the 54 we had on the first list.' },
    { no: '02', name: 'Sofa, sage microfiber', dimensions: 'About 88 inches', room: undefined, scenarioDependent: true, low: 900, high: 1_600, treatment: 'Slipcover in washed cotton or linen, flax or oatmeal.' },
    { no: '03', name: 'Loveseat, matching', dimensions: 'About 72 inches', scenarioDependent: true, low: 700, high: 1_200, treatment: 'Slipcover to match the sofa.' },
    { no: '04', name: 'Console table, cream cabriole', dimensions: '55 wide by 32 high by 14 deep', confirmed: true, room: 'foyer', low: 250, high: 450 },
    { no: '05', name: 'Carved mahogany side table with Tiffany style lamp', room: 'club-room', low: 250, high: 400, description: 'Goes in the club room corner.' },
    { no: '06', name: 'Dresser, white lacquer with glass top', room: '2nd-bedroom', low: 600, high: 1_100, description: 'The strongest piece in the inventory.' },
    { no: '07', name: 'White upholstered bed with lacquer nightstand', room: '2nd-bedroom', low: 800, high: 1_350, description: 'The linens all go. Bedding is all new.' },
    { no: null, name: 'Ornate baroque mirror', dimensions: '4 feet 1 inch wide by 3 feet 2 inches high', confirmed: true, room: 'foyer', low: 150, high: 350, description: 'Confirmed keep. Hangs over the console in the foyer.' },
    { no: null, name: 'TV stand', dimensions: '58 inches', confirmed: true, room: 'club-room' },
    { no: null, name: 'Two TVs', dimensions: '55 inches each', confirmed: true },
    // ASSUMPTION: the daughter's white set is listed separately in the source
    // from pieces 06 and 07, which are also white lacquer going to the same
    // room. These two are the items that do not overlap with 06 and 07.
    { no: null, name: 'White chest', room: '2nd-bedroom', description: "Part of the daughter's white set." },
    { no: null, name: 'White hamper', room: '2nd-bedroom', description: "Part of the daughter's white set." },
  ]

  for (const piece of pieces) {
    await prisma.reusePiece.create({
      data: {
        projectId: project.id,
        inventoryNo: piece.no,
        name: piece.name,
        description: piece.description ?? null,
        dimensions: piece.dimensions ?? null,
        measurementsConfirmed: piece.confirmed ?? false,
        status: KeepStatus.KEEP,
        scenarioDependent: piece.scenarioDependent ?? false,
        destinationRoomId: piece.room ? rooms[piece.room] : null,
        replacementLowCents: piece.low ? d(piece.low) : null,
        replacementHighCents: piece.high ? d(piece.high) : null,
        treatmentNote: piece.treatment ?? null,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Art
  //
  // Every size on file is estimated from a photograph, so sizeConfirmed is
  // false throughout until the real framed dimensions come in.
  //
  // ASSUMPTION on reframing: the source approves reframing three or four
  // pieces to black and natural wood and says the Peter Lik panoramas keep
  // their matching steel. The beach chair pair already has thin black frames.
  // That leaves exactly these four as the reframe candidates.
  // -------------------------------------------------------------------------
  type ArtSeed = {
    title: string
    artist?: string
    w?: number
    h?: number
    label?: string
    decision: ArtDecision
    reframe: ReframeStatus
    heavy?: boolean
    finish?: string
    note?: string
  }

  const art: ArtSeed[] = [
    { title: 'Sand dune panorama', artist: 'Peter Lik', w: 72, h: 36, label: '3 feet by 6 feet, horizontal', decision: ArtDecision.IN, reframe: ReframeStatus.NOT_NEEDED, heavy: true, finish: 'Matching steel, staying as is', note: 'Heavy and under glass. Needs studs or a cleat.' },
    { title: 'Windmill and canola field', artist: 'Peter Lik', w: 60, h: 24, label: '2 feet by 5 feet, horizontal', decision: ArtDecision.IN, reframe: ReframeStatus.NOT_NEEDED, heavy: true, finish: 'Matching steel, staying as is', note: 'Heavy and under glass. Needs studs or a cleat.' },
    { title: 'Third Peter Lik piece', artist: 'Peter Lik', w: 36, h: 72, label: '3 feet by 6 feet, vertical', decision: ArtDecision.IN, reframe: ReframeStatus.NOT_NEEDED, heavy: true, finish: 'Matching steel, staying as is', note: 'The one you texted during the call. Approved, there is enough blue in it to offset the red.' },
    { title: 'Junk Vendor', artist: 'Seymour Rosenthal', decision: ArtDecision.IN, reframe: ReframeStatus.APPROVED_TO_REFRAME, note: 'Signed and numbered pencil lithograph.' },
    { title: 'Beach chair pair, black and white', w: 12, h: 12, label: '1 foot by 1 foot each', decision: ArtDecision.IN, reframe: ReframeStatus.NOT_NEEDED, finish: 'Thin black frames, already right', note: 'A pair.' },
    { title: 'Jerusalem folk art print', decision: ArtDecision.IN, reframe: ReframeStatus.APPROVED_TO_REFRAME, note: 'The most personal piece. This one gets a real wall.' },
    { title: 'Nymphéas', artist: 'Monet', w: 48, h: 36, label: 'About 3 feet by 4 feet', decision: ArtDecision.IN, reframe: ReframeStatus.APPROVED_TO_REFRAME, note: 'There is no red in it. It was photographed on a red wall.' },
    { title: 'Blue and green floral lithograph', w: 30, label: 'About 30 inches wide', decision: ArtDecision.IN, reframe: ReframeStatus.APPROVED_TO_REFRAME, note: 'Signed.' },
    { title: 'Red poppies', decision: ArtDecision.OUT, reframe: ReframeStatus.NOT_NEEDED },
    { title: 'Flower market courtyard', decision: ArtDecision.OUT, reframe: ReframeStatus.NOT_NEEDED },
  ]

  for (const piece of art) {
    await prisma.artPiece.create({
      data: {
        projectId: project.id,
        title: piece.title,
        artist: piece.artist ?? null,
        widthIn: piece.w ?? null,
        heightIn: piece.h ?? null,
        sizeLabel: piece.label ?? null,
        sizeConfirmed: false,
        decision: piece.decision,
        reframeStatus: piece.reframe,
        frameFinish: piece.finish ?? null,
        needsStudsOrCleat: piece.heavy ?? false,
        wallNote: piece.note ?? null,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Open items
  // -------------------------------------------------------------------------
  const clientItems: [string, string | null, boolean][] = [
    ['Are the windows cased or drywall returns', null, false],
    ['Window sizes for the blind order', 'We cannot order blinds without these.', true],
    ['Which guest room mattress your kids bought', 'Roughly $300 to $400.', false],
    ['Electric blinds or the pull from the middle style', 'Once you see the price gap.', false],
    ['Street address or lot number, once GL Homes assigns it', 'Needed for delivery scheduling and the blind measure.', true],
    ['Confirm the existing guest bed size', 'This decides queen or king for the 2nd bedroom mattress.', true],
    ['Confirm the island run length, 3 stools or 4', null, true],
    ['Actual framed dimensions of the remaining art', 'Every size we have is estimated from a photograph, and scale decides which wall a piece can hold.', false],
  ]

  for (const [index, [title, detail, blocks]] of clientItems.entries()) {
    await prisma.openItem.create({
      data: {
        projectId: project.id,
        owner: OpenItemOwner.CLIENT,
        title,
        detail,
        order: index + 1,
        blocksOrdering: blocks,
      },
    })
  }

  const designerItems: [string, string | null, boolean][] = [
    ['Pricing proposal', 'Jesse sends this as an invoice for you to review.', true],
    ['Electric blind pricing', 'Including the gap between electric and pull from the middle.', false],
    ['Updated site with the dialed in options', 'Jesse is on this.', false],
    ['Furniture and decor selections, 3 options maximum per item', null, true],
    ['Ceiling fan selections', 'These can ship early for your electrician. Five fans plus the one you asked about over the kitchen table, so the count needs settling.', false],
    ['Mattress recommendation for the primary', 'The steer is hybrid over memory foam. Memory foam wears out faster and conforms to one body.', false],
    ['Design services agreement', 'Signed before design work continues.', true],
  ]

  for (const [index, [title, detail, blocks]] of designerItems.entries()) {
    await prisma.openItem.create({
      data: {
        projectId: project.id,
        owner: OpenItemOwner.DESIGNER,
        title,
        detail,
        order: index + 1,
        blocksOrdering: blocks,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------
  const milestones: [string, string, string | null, string | null, boolean][] = [
    [
      'Upholstery orders placed',
      'December 2026',
      'This is the one with a hard edge. Vendors lock price at order acknowledgement, they reset price lists on January 1 as routine, and Chinese New Year shuts factories for two to three weeks in early February. Order in December and the price is locked and production beats the shutdown.',
      '2026-12-31',
      true,
    ],
    [
      'Move to the Florida rental',
      'January 2027',
      'All the Colorado furniture and art ships to the rental. The lease runs almost 7 months. Case goods, rugs and lighting get ordered this month.',
      '2027-01-01',
      false,
    ],
    ['Builder says the house is ready', 'March to April 2027', 'Moved up from May or June without warning.', null, false],
    ['Earliest close', 'April 1, 2027', 'The builder said you can push a couple of weeks past this.', '2027-04-01', false],
    [
      'Install',
      'After April 1, 2027',
      'There is a 3 month cushion so the exact week is flexible. Install goes before the garage epoxy, not after, because Davina and Jesse work out of the garage.',
      null,
      false,
    ],
  ]

  for (const [index, [label, dateLabel, detail, occursOn, isDeadline]] of milestones.entries()) {
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        label,
        dateLabel,
        detail,
        occursOn: occursOn ? new Date(`${occursOn}T00:00:00Z`) : null,
        order: index + 1,
        isDeadline,
      },
    })
  }

  const counts = {
    rooms: await prisma.room.count(),
    selections: await prisma.selection.count(),
    budgetLines: await prisma.budgetLine.count(),
    pieces: await prisma.reusePiece.count(),
    art: await prisma.artPiece.count(),
    openItems: await prisma.openItem.count(),
    milestones: await prisma.milestone.count(),
  }

  console.log('Seeded', {
    project: project.displayName,
    client: abbie.name,
    designers: [davina.name, jesse.name],
    ...counts,
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
