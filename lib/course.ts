import { Prisma, Role, type User } from '@prisma/client'
import { notFound } from 'next/navigation'
import { dominatingYourBusiness } from '@/content/courses/dominating-your-business'
import { AuditAction, record } from './audit'
import {
  AnswerError,
  findField,
  findModule,
  isAnswered,
  parseAnswer,
  stepsFor,
  type Course,
  type Module,
} from './course-content'
import { prisma } from './db'

/**
 * The training course: who can open it, saving answers, turning homework in,
 * and the live session.
 *
 * Content comes from content/courses/ and is never written here. See the note
 * on WorksheetAnswer in the schema for why answers point at it by key.
 */

export const COURSES: Course[] = [dominatingYourBusiness]

export function courseBySlug(slug: string): Course | undefined {
  return COURSES.find((course) => course.slug === slug)
}

/**
 * Agents take the course and designers teach it. A client never sees it: the
 * course has Dominate Homes splits and fees in it, which are team business.
 */
export function canOpenCourses(user: User): boolean {
  return user.role === Role.AGENT || user.role === Role.DESIGNER
}

export function requireCourse(user: User, slug: string): Course {
  const course = courseBySlug(slug)
  if (!course || !canOpenCourses(user)) notFound()
  return course
}

export function requireModule(course: Course, key: string): Module {
  const unit = findModule(course, key)
  if (!unit) notFound()
  return unit
}

export { AnswerError }

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type Answers = Record<string, unknown>

/** One person's answers for one module, by question key. */
export async function answersFor(userId: string, courseSlug: string, moduleKey: string): Promise<Answers> {
  const rows = await prisma.worksheetAnswer.findMany({ where: { userId, courseSlug, moduleKey } })
  return Object.fromEntries(rows.map((row) => [row.fieldKey, row.value]))
}

/** Every answer one person has written in a course, by module then question. */
export async function allAnswersFor(userId: string, courseSlug: string): Promise<Record<string, Answers>> {
  const rows = await prisma.worksheetAnswer.findMany({ where: { userId, courseSlug } })
  const byModule: Record<string, Answers> = {}
  for (const row of rows) {
    byModule[row.moduleKey] ??= {}
    byModule[row.moduleKey][row.fieldKey] = row.value
  }
  return byModule
}

/**
 * Saves one answer, for the person signed in and nobody else.
 *
 * There is no user id argument on purpose. The worksheet saves as people
 * type, so this is called constantly from the browser, and an action that
 * took a user id would be one edited request away from writing into somebody
 * else's homework.
 */
export async function saveAnswer(
  user: User,
  courseSlug: string,
  moduleKey: string,
  fieldKey: string,
  value: unknown,
): Promise<void> {
  if (!canOpenCourses(user)) throw new AnswerError('This account does not take the course.')

  const course = courseBySlug(courseSlug)
  const unit = course ? findModule(course, moduleKey) : undefined
  const field = unit ? findField(unit, fieldKey) : undefined
  if (!field) throw new AnswerError('That question is not on this worksheet any more. Refresh the page.')

  const clean = parseAnswer(field, value) as Prisma.InputJsonValue

  await prisma.worksheetAnswer.upsert({
    where: { userId_courseSlug_moduleKey_fieldKey: { userId: user.id, courseSlug, moduleKey, fieldKey } },
    create: { userId: user.id, courseSlug, moduleKey, fieldKey, value: clean },
    update: { value: clean },
  })
}

/**
 * Marks a module's homework as turned in.
 *
 * Turning in twice keeps the first time. Monday's question is "did they hand
 * it in by the deadline", and a second click on Tuesday should not move the
 * answer to that.
 */
export async function turnIn(user: User, courseSlug: string, moduleKey: string): Promise<Date> {
  if (!canOpenCourses(user)) throw new AnswerError('This account does not take the course.')

  const course = courseBySlug(courseSlug)
  const unit = course ? findModule(course, moduleKey) : undefined
  if (!course || !unit) throw new AnswerError('No such module.')

  const existing = await prisma.homeworkTurnIn.findUnique({
    where: { userId_courseSlug_moduleKey: { userId: user.id, courseSlug, moduleKey } },
  })
  if (existing) return existing.turnedInAt

  const created = await prisma.homeworkTurnIn.create({
    data: { userId: user.id, courseSlug, moduleKey },
  })

  await record({
    action: AuditAction.HOMEWORK_TURNED_IN,
    actor: user,
    subjectType: 'HomeworkTurnIn',
    subjectId: created.id,
    summary: `${user.name} turned in the ${unit.worksheet.title.toLowerCase()} (${course.title}, module ${unit.number})`,
  })

  return created.turnedInAt
}

export async function turnedInAt(userId: string, courseSlug: string, moduleKey: string): Promise<Date | null> {
  const row = await prisma.homeworkTurnIn.findUnique({
    where: { userId_courseSlug_moduleKey: { userId, courseSlug, moduleKey } },
  })
  return row?.turnedInAt ?? null
}

export type ModuleProgress = {
  answered: number
  total: number
  turnedInAt: Date | null
}

function progressOf(unit: Module, answers: Answers | undefined, turnedIn: Date | null): ModuleProgress {
  const fields = unit.worksheet.fields
  return {
    answered: fields.filter((field) => isAnswered(field, answers?.[field.key])).length,
    total: fields.length,
    turnedInAt: turnedIn,
  }
}

/** How far one person is through every module, by module key. */
export async function progressFor(userId: string, course: Course): Promise<Record<string, ModuleProgress>> {
  const [answers, turnIns] = await Promise.all([
    allAnswersFor(userId, course.slug),
    prisma.homeworkTurnIn.findMany({ where: { userId, courseSlug: course.slug } }),
  ])

  const turned = new Map(turnIns.map((row) => [row.moduleKey, row.turnedInAt]))
  return Object.fromEntries(
    course.modules.map((unit) => [
      unit.key,
      progressOf(unit, answers[unit.key], turned.get(unit.key) ?? null),
    ]),
  )
}

/**
 * The whole class, for Davina: every agent and where each one is on every
 * module. Agents only. Designers can fill in a worksheet to try it, and that
 * should not show up as a student.
 */
export async function classProgress(course: Course) {
  const [agents, answers, turnIns] = await Promise.all([
    prisma.user.findMany({ where: { role: Role.AGENT }, orderBy: { name: 'asc' } }),
    prisma.worksheetAnswer.findMany({
      where: { courseSlug: course.slug, user: { role: Role.AGENT } },
      select: { userId: true, moduleKey: true, fieldKey: true, value: true },
    }),
    prisma.homeworkTurnIn.findMany({ where: { courseSlug: course.slug, user: { role: Role.AGENT } } }),
  ])

  const answersBy = new Map<string, Answers>()
  for (const row of answers) {
    const key = `${row.userId}:${row.moduleKey}`
    const bucket = answersBy.get(key) ?? {}
    bucket[row.fieldKey] = row.value
    answersBy.set(key, bucket)
  }
  const turnedBy = new Map(turnIns.map((row) => [`${row.userId}:${row.moduleKey}`, row.turnedInAt]))

  return agents.map((agent) => ({
    agent,
    modules: Object.fromEntries(
      course.modules.map((unit) => {
        const key = `${agent.id}:${unit.key}`
        return [unit.key, progressOf(unit, answersBy.get(key), turnedBy.get(key) ?? null)]
      }),
    ) as Record<string, ModuleProgress>,
  }))
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

/**
 * A session nobody has moved for this long is treated as over. Otherwise a
 * presenter who closed the laptop without pressing "End" would leave every
 * agent's page saying "live now" until next Monday.
 */
export const LIVE_IDLE_HOURS = 3

export type LiveState = {
  moduleKey: string
  step: number
  presenterName: string
  updatedAt: Date
}

export async function liveState(courseSlug: string, now = new Date()): Promise<LiveState | null> {
  const row = await prisma.liveSession.findUnique({ where: { courseSlug } })
  if (!row || row.endedAt) return null
  if (now.getTime() - row.updatedAt.getTime() > LIVE_IDLE_HOURS * 3_600_000) return null

  return {
    moduleKey: row.moduleKey,
    step: row.step,
    presenterName: row.presenterName,
    updatedAt: row.updatedAt,
  }
}

export class LiveError extends Error {}

/** Puts everyone following along on this slide. Designers only. */
export async function presentStep(
  actor: User,
  courseSlug: string,
  moduleKey: string,
  step: number,
): Promise<void> {
  if (actor.role !== Role.DESIGNER) throw new LiveError('Only Davina can run the live session.')

  const course = courseBySlug(courseSlug)
  const unit = course ? findModule(course, moduleKey) : undefined
  if (!unit) throw new LiveError('No such module.')

  const last = stepsFor(unit).length - 1
  const clamped = Math.max(0, Math.min(last, Math.trunc(step)))

  await prisma.liveSession.upsert({
    where: { courseSlug },
    create: { courseSlug, moduleKey, step: clamped, presenterName: actor.name.split(' ')[0] },
    update: {
      moduleKey,
      step: clamped,
      presenterName: actor.name.split(' ')[0],
      endedAt: null,
    },
  })
}

export async function endLive(actor: User, courseSlug: string): Promise<void> {
  if (actor.role !== Role.DESIGNER) throw new LiveError('Only Davina can run the live session.')
  await prisma.liveSession.updateMany({ where: { courseSlug, endedAt: null }, data: { endedAt: new Date() } })
}
