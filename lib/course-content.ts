import { z } from 'zod'

/**
 * The shape of a course, and the rules an answer has to follow.
 *
 * A course is written in code under content/courses/ rather than in the
 * database. Lessons are long, they change in pull requests, and the person
 * who teaches from them should be able to see exactly what changed and when.
 * The database only holds what agents do with it: see WorksheetAnswer.
 *
 * Nothing in here touches the database, so all of it can be tested without
 * one and imported from a client component.
 */

/** One piece of a lesson, in the order it is read and presented. */
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  /** A formula, a rule or a line worth putting on the wall. */
  | { kind: 'callout'; label?: string; text: string }
  /** A short label then its meaning, e.g. "Goal: what you are going for." */
  | { kind: 'terms'; items: { term: string; meaning: string }[] }

export type Lesson = {
  /** Permanent once taught. Used in links and to remember the live slide. */
  key: string
  title: string
  blocks: Block[]
  /** What Davina wants in front of her while she talks. Only she sees it. */
  notes?: string
}

export type Field =
  | { kind: 'text'; key: string; label: string; help?: string }
  | { kind: 'long'; key: string; label: string; help?: string }
  | { kind: 'number'; key: string; label: string; help?: string }
  | { kind: 'choice'; key: string; label: string; options: string[]; help?: string }
  /** Tick boxes. The answer is the list of ticked options. */
  | { kind: 'checks'; key: string; label: string; options: string[]; help?: string }
  /**
   * A sentence with blanks, e.g. the value prop. Each part is its own box and
   * the finished sentence builds underneath as they type.
   */
  | {
      kind: 'sentence'
      key: string
      label: string
      /** Parts are written into it as {key}, e.g. "I help {who} achieve {outcome}." */
      template: string
      parts: { key: string; label: string }[]
      help?: string
    }
  /** Typing your name to sign. Stored as the name and the moment it was typed. */
  | { kind: 'signature'; key: string; label: string; help?: string }

export type Worksheet = {
  title: string
  /** ISO date, e.g. "2026-11-02". */
  due: string
  fields: Field[]
}

export type Module = {
  /** Permanent once agents have written against it. */
  key: string
  number: number
  title: string
  /** The Monday it is taught, ISO date. */
  date: string
  goal: string
  /** Read first, before the lessons. Davina's own words. */
  opening?: Lesson
  lessons: Lesson[]
  worksheet: Worksheet
  /**
   * A note for Davina about what is still being written. Shown only on the
   * design side, never to an agent.
   */
  draftNote?: string
}

export type Course = {
  slug: string
  title: string
  tagline: string
  /** Who it is for, shown on the overview. */
  audience: string
  modules: Module[]
}

/**
 * The slides, in order, for one module.
 *
 * The presenter view, the agent's page and the live session all count steps
 * the same way: the opening if there is one, each lesson, then the worksheet.
 * A step is an index into this list, so it has to be built in one place.
 */
export type Step =
  | { kind: 'lesson'; lesson: Lesson; isOpening: boolean }
  | { kind: 'worksheet'; worksheet: Worksheet }

export function stepsFor(unit: Module): Step[] {
  const steps: Step[] = []
  if (unit.opening) steps.push({ kind: 'lesson', lesson: unit.opening, isOpening: true })
  for (const lesson of unit.lessons) steps.push({ kind: 'lesson', lesson, isOpening: false })
  steps.push({ kind: 'worksheet', worksheet: unit.worksheet })
  return steps
}

export function stepTitle(step: Step): string {
  return step.kind === 'lesson' ? step.lesson.title : step.worksheet.title
}

export function findModule(course: Course, key: string): Module | undefined {
  return course.modules.find((unit) => unit.key === key)
}

export function findField(unit: Module, key: string): Field | undefined {
  return unit.worksheet.fields.find((field) => field.key === key)
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

const MAX_TEXT = 10_000

const text = z.string().max(MAX_TEXT)

/** What a stored answer looks like for each kind of question. */
function schemaFor(field: Field) {
  switch (field.kind) {
    case 'text':
    case 'long':
      return text
    case 'number':
      // Kept as typed. "about 40" is a real answer to "how many people are in
      // your database" and rounding it to a number would lose the "about".
      return z.string().max(100)
    case 'choice':
      return z.union([z.literal(''), z.enum(field.options as [string, ...string[]])])
    case 'checks':
      // Not capped at the number of options: a double click can send a box
      // twice, and duplicates are dropped below rather than refused.
      return z.array(z.enum(field.options as [string, ...string[]])).max(100)
    case 'sentence':
      return z.object(
        Object.fromEntries(field.parts.map((part) => [part.key, text.optional()])),
      ).strict()
    case 'signature':
      return z.object({ name: z.string().max(200), signedAt: z.string().max(40) }).strict()
  }
}

export class AnswerError extends Error {}

/** Checks an answer against its question. Throws AnswerError when it does not fit. */
export function parseAnswer(field: Field, value: unknown): unknown {
  const result = schemaFor(field).safeParse(value)
  if (!result.success) throw new AnswerError(`That answer does not fit "${field.label}".`)

  if (field.kind === 'checks') {
    // Duplicates would make a box look ticked twice on the printout.
    return [...new Set(result.data as string[])]
  }

  return result.data
}

/** True when there is something written. Used for "how far along are they". */
export function isAnswered(field: Field, value: unknown): boolean {
  if (value === null || value === undefined) return false

  switch (field.kind) {
    case 'text':
    case 'long':
    case 'number':
    case 'choice':
      return typeof value === 'string' && value.trim().length > 0
    case 'checks':
      return Array.isArray(value) && value.length > 0
    case 'sentence':
      return Object.values(value as Record<string, string | undefined>).some((part) => part?.trim())
    case 'signature':
      return Boolean((value as { name?: string }).name?.trim())
  }
}

/** The finished sentence for a fill-in-the-blanks question, blanks shown as ___. */
export function fillSentence(
  field: Extract<Field, { kind: 'sentence' }>,
  value: Record<string, string | undefined> | null | undefined,
): string {
  return field.template.replace(/\{(\w+)\}/g, (_, key: string) => value?.[key]?.trim() || '___')
}

/**
 * Problems with a course definition, empty when it is sound.
 *
 * Keys are how answers find their way back to a question, so two questions
 * sharing a key would quietly overwrite each other's answers. That is the
 * mistake this exists to catch, and a test runs it over every course.
 */
export function courseProblems(course: Course): string[] {
  const problems: string[] = []
  const moduleKeys = new Set<string>()

  for (const unit of course.modules) {
    if (moduleKeys.has(unit.key)) problems.push(`Two modules use the key "${unit.key}".`)
    moduleKeys.add(unit.key)

    const lessonKeys = new Set<string>()
    for (const step of stepsFor(unit)) {
      if (step.kind !== 'lesson') continue
      if (lessonKeys.has(step.lesson.key)) {
        problems.push(`${unit.key}: two lessons use the key "${step.lesson.key}".`)
      }
      lessonKeys.add(step.lesson.key)
    }

    const fieldKeys = new Set<string>()
    for (const field of unit.worksheet.fields) {
      if (fieldKeys.has(field.key)) {
        problems.push(`${unit.key}: two worksheet questions use the key "${field.key}".`)
      }
      fieldKeys.add(field.key)

      if (field.kind === 'sentence') {
        for (const part of field.parts) {
          if (!field.template.includes(`{${part.key}}`)) {
            problems.push(`${unit.key}.${field.key}: the sentence has no {${part.key}} blank.`)
          }
        }
      }
      if ((field.kind === 'choice' || field.kind === 'checks') && field.options.length === 0) {
        problems.push(`${unit.key}.${field.key}: no options to pick from.`)
      }
    }

    for (const date of [unit.date, unit.worksheet.due]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(`${unit.key}: "${date}" is not a date.`)
    }
  }

  return problems
}

/**
 * "Monday, October 26". Course dates are calendar days with no time of day,
 * so they are read at noon UTC, which is the same day in every US time zone.
 */
export function courseDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
