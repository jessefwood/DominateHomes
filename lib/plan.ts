import type { Field } from './course-content'

/**
 * The 2027 business plan, built inside the course.
 *
 * It replaces the per-agent plan pages, which saved only in the agent's own
 * browser: Davina never saw them and they vanished with a new laptop. Here
 * the answers save to the account like homework, so she can open any agent's
 * plan and build it with them.
 *
 * Two rules from Davina shape it:
 *
 *   No gross commission anywhere. Agents plan from what reaches them: their
 *   take-home on an average closing, after the split, referral fees, the
 *   team fee and the brokerage fee. The splits are applied before the number
 *   ever gets here (see PlanStart in the schema).
 *
 *   Surviving and thriving stay private. Those fields are never sent to the
 *   design side. Davina sees only what they add up to: how many closings the
 *   plan runs on.
 *
 * Nothing in here touches the database, so the same arithmetic runs in the
 * browser as the agent types and on the server for Davina's view.
 */

/** Answers for the plan are stored like a module's, under this key. */
export const PLAN_KEY = 'plan-2027'

export type PlanField = Field & { private?: boolean }

export type PlanSection = {
  key: string
  title: string
  intent: string
  fields: PlanField[]
  /** Every field in it is private, and the section says so. */
  private?: boolean
}

/** The team's working model, from the Last Half, Best Half plan. */
export const TEAM_MODEL = {
  conversion: 0.6,
  fallout: 0.2,
  workingWeeks: 46,
  sphereShare: 0.7,
  /** Closings a year from a hundred people worked. */
  spherePerHundred: 8,
} as const

export const PLAN_SECTIONS: PlanSection[] = [
  {
    key: 'where',
    title: 'Where you actually are',
    intent: 'You cannot plan forward from a year you have not looked back at. Honest, not perfect.',
    fields: [
      { kind: 'number', key: 'closings_2026', label: 'Closings in 2026', help: 'Closed plus under contract. Pre-filled from the team workbook.' },
      { kind: 'number', key: 'listing_sides', label: 'Of those, listing sides' },
      { kind: 'number', key: 'buyer_sides', label: 'Of those, buyer sides' },
      {
        kind: 'number',
        key: 'take_home',
        label: 'What you take home on an average closing',
        help: 'After your split, referral fees, the $200 team fee and the $495 brokerage fee. Pre-filled from the team workbook.',
      },
      { kind: 'number', key: 'database_count', label: 'People in your Follow Up Boss database today' },
      { kind: 'long', key: 'ly_source', label: 'Where the business actually came from' },
      { kind: 'long', key: 'ly_worked', label: 'What worked that you stopped doing?' },
      { kind: 'long', key: 'ly_struggle', label: 'What was inconsistent or missing?' },
      { kind: 'long', key: 'ly_change', label: 'What has to change from here?' },
    ],
  },
  {
    key: 'number',
    title: 'Your 2027 number',
    intent: 'Last year, plus the growth you are committing to.',
    fields: [
      {
        kind: 'number',
        key: 'target_2027',
        label: 'Your 2027 closings target',
        help: "Set with Davina as part of the team's two hundred closing goal.",
      },
    ],
  },
  {
    key: 'life',
    title: 'Surviving and thriving',
    intent:
      'Surviving is what a year costs to be you and run your business. Thriving is the extra that makes it a year worth having. Most agents only plan for surviving. That is why most agents only survive.',
    private: true,
    fields: [
      { kind: 'number', key: 'surviving', label: 'Surviving: what a year costs me, personal and business', help: 'Monthly times twelve is fine.', private: true },
      { kind: 'number', key: 'thriving', label: 'Thriving: the extra on top', private: true },
      {
        kind: 'long',
        key: 'thriving_list',
        label: 'Name them',
        help: 'The actual things. You will read this in July when you do not feel like making the calls.',
        private: true,
      },
      { kind: 'number', key: 'tax_rate', label: 'Percent you set aside for taxes', help: 'Your accountant’s number. Thirty if you do not have one yet.', private: true },
    ],
  },
  {
    key: 'pillars',
    title: 'Your four pillars',
    intent: 'SOI is required for everyone. Start with SOI plus one, and add the next once the first two are consistent.',
    fields: [
      { kind: 'number', key: 'p1_calls', label: 'Pillar 1, SOI: personal calls a week' },
      { kind: 'number', key: 'p1_texts', label: 'Pillar 1, SOI: personal texts a week' },
      { kind: 'number', key: 'p1_notes', label: 'Pillar 1, SOI: handwritten notes a week' },
      { kind: 'number', key: 'p1_popbys', label: 'Pillar 1, SOI: pop-bys a month' },
      { kind: 'long', key: 'p1_more', label: 'Anything else in your SOI plan', help: 'Events, newsletter, annual CMAs, birthdays and home anniversaries, social.' },
      {
        kind: 'choice',
        key: 'second_pillar',
        label: 'Your second pillar',
        options: ['Paid and partner', 'Content', 'Cold'],
      },
      { kind: 'long', key: 'p2_plan', label: 'Pillar 2, Paid and partner: which sources, and what you do each week' },
      { kind: 'long', key: 'p3_plan', label: 'Pillar 3, Content: what you post, and how often' },
      { kind: 'long', key: 'p4_plan', label: 'Pillar 4, Cold: open houses, circle prospecting, FSBOs, expireds, farming' },
    ],
  },
  {
    key: 'story',
    title: 'Your story, and who you are for',
    intent: 'The plan is numbers. This is the reason anybody picks you.',
    fields: [
      { kind: 'long', key: 'my_story', label: 'Your story' },
      { kind: 'long', key: 'ideal_client', label: 'Who you are for' },
      { kind: 'long', key: 'why', label: 'Why this year matters' },
    ],
  },
  {
    key: 'week',
    title: 'Your perfect week',
    intent: 'If it is not on the calendar it is not in the plan.',
    fields: [
      { kind: 'text', key: 'power_hours', label: 'Power hours', help: 'The team runs them at 8:30, 11:30 and 4:30.' },
      { kind: 'text', key: 'soi_time', label: 'SOI time' },
      { kind: 'text', key: 'content_time', label: 'Content time' },
      { kind: 'text', key: 'appt_days', label: 'Appointment days' },
      { kind: 'text', key: 'off_time', label: 'Family and time off' },
    ],
  },
  {
    key: 'commit',
    title: 'What you are committing to',
    intent: 'Your goal is what you hope for. Your standard is what you are held to. Your habits decide which one you hit.',
    fields: [
      { kind: 'text', key: 'accountability', label: 'Your accountability partner' },
      { kind: 'long', key: 'my_standard', label: 'The standard you are holding yourself to' },
      { kind: 'signature', key: 'signature', label: 'Type your name to sign' },
    ],
  },
]

export const PLAN_FIELDS: PlanField[] = PLAN_SECTIONS.flatMap((section) => section.fields)

export const PRIVATE_KEYS = new Set(PLAN_FIELDS.filter((field) => field.private).map((field) => field.key))

/** Where a plan starts, before the agent has typed anything. */
export type PlanStartValues = {
  closings2026: number
  listingSides: number
  buyerSides: number
  takeHome: number
  databaseCount: number
  target2027: number
}

/** The pre-filled answers, as the strings the form shows. */
export function startingAnswers(start: PlanStartValues | null): Record<string, string> {
  if (!start) return { tax_rate: '30' }
  return {
    closings_2026: String(start.closings2026),
    listing_sides: String(start.listingSides),
    buyer_sides: String(start.buyerSides),
    take_home: String(start.takeHome),
    database_count: String(start.databaseCount),
    target_2027: String(start.target2027),
    tax_rate: '30',
  }
}

/** "$7,350", "7350", "30%" and " 12 " all read as numbers. Anything else is zero. */
export function readNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const parsed = Number.parseFloat(value.replace(/[$,%\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Everything the plan works out, from the answers. */
export type PlanNumbers = {
  closings2026: number
  takeHome: number
  target: number
  takeHomeAtTarget: number
  extraClosings: number
  extraPerMonth: number
  /** Null when the private section is empty, or not visible to whoever is looking. */
  lifeNeedsAfterTax: number | null
  lifeNeedsBeforeTax: number | null
  lifeClosings: number | null
  /** Whichever is bigger: the target, or what life costs. */
  planClosings: number
  drivenBy: 'target' | 'life'
  sphereClosings: number
  leadClosings: number
  contracts: number
  agreements: number
  apptsMet: number
  apptsSet: number
  conversations: number
  conversationsPerWeek: number
  conversationsPerDay: number
  databaseNeeded: number
  databaseToAdd: number
  databaseToAddPerWeek: number
}

/**
 * Works the plan through.
 *
 * `lifeClosingsOverride` is for Davina's view, which never receives the
 * private answers: the server works out how many closings the agent's life
 * costs and passes only that number in.
 */
export function computePlan(answers: Record<string, unknown>, lifeClosingsOverride?: number | null): PlanNumbers {
  const m = TEAM_MODEL
  const closings2026 = readNumber(answers.closings_2026)
  const takeHome = readNumber(answers.take_home)
  const target = Math.max(0, Math.round(readNumber(answers.target_2027)))

  const surviving = readNumber(answers.surviving)
  const thriving = readNumber(answers.thriving)
  const taxRate = Math.min(90, Math.max(0, readNumber(answers.tax_rate ?? '30'))) / 100

  let lifeNeedsAfterTax: number | null = null
  let lifeNeedsBeforeTax: number | null = null
  let lifeClosings: number | null = lifeClosingsOverride ?? null

  if (lifeClosingsOverride === undefined && surviving + thriving > 0) {
    lifeNeedsAfterTax = surviving + thriving
    // Rounded to the dollar first: 84,000 / 0.7 is 120,000.00000000001 in
    // floating point, and ceil would turn that into one closing too many.
    lifeNeedsBeforeTax = Math.round(lifeNeedsAfterTax / (1 - taxRate))
    lifeClosings = takeHome > 0 ? Math.ceil(lifeNeedsBeforeTax / takeHome) : null
  }

  const planClosings = Math.max(target, lifeClosings ?? 0)
  const drivenBy = lifeClosings !== null && lifeClosings > target ? 'life' : 'target'

  const contracts = Math.ceil(planClosings / (1 - m.fallout))
  const agreements = Math.ceil(contracts / m.conversion)
  const apptsMet = Math.ceil(agreements / m.conversion)
  const apptsSet = Math.ceil(apptsMet / m.conversion)
  const conversations = Math.ceil(apptsSet / m.conversion)

  const sphereClosings = Math.ceil(planClosings * m.sphereShare)
  const databaseNeeded = Math.ceil((sphereClosings / m.spherePerHundred) * 100)
  const databaseToAdd = Math.max(0, databaseNeeded - readNumber(answers.database_count))

  return {
    closings2026,
    takeHome,
    target,
    takeHomeAtTarget: target * takeHome,
    extraClosings: target - closings2026,
    extraPerMonth: (target - closings2026) / 12,
    lifeNeedsAfterTax,
    lifeNeedsBeforeTax,
    lifeClosings,
    planClosings,
    drivenBy,
    sphereClosings,
    leadClosings: planClosings - sphereClosings,
    contracts,
    agreements,
    apptsMet,
    apptsSet,
    conversations,
    conversationsPerWeek: Math.ceil(conversations / m.workingWeeks),
    conversationsPerDay: conversations / m.workingWeeks / 5,
    databaseNeeded,
    databaseToAdd,
    databaseToAddPerWeek: Math.ceil(databaseToAdd / m.workingWeeks),
  }
}

/** The answers with every private field taken out, for anyone but the agent. */
export function withoutPrivate(answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(answers).filter(([key]) => !PRIVATE_KEYS.has(key)))
}

/**
 * One line per agent, pasted from the team workbook:
 * "email, 2026 closings, listing sides, buyer sides, take-home per closing, database, 2027 target".
 */
export function parseStartingNumbers(text: string): { line: string; email: string; values: PlanStartValues | null }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]+/).map((part) => part.trim())
      const email = (parts.find((part) => part.includes('@')) ?? '').toLowerCase()
      // A name is allowed at the front and is ignored: the address is what
      // matches the plan to the person. Numbers are written without commas,
      // because the comma is what separates them.
      const numbers = parts.filter((part) => /^[$\d.%]+$/.test(part)).map(readNumber)
      if (!email || numbers.length !== 6) return { line, email, values: null }
      const [closings2026, listingSides, buyerSides, takeHome, databaseCount, target2027] = numbers
      return { line, email, values: { closings2026, listingSides, buyerSides, takeHome, databaseCount, target2027 } }
    })
}
