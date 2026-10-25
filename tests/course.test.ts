import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { AuditAction, InviteRole, Phase, Role } from '@prisma/client'
import {
  answersFor,
  AnswerError,
  classProgress,
  COURSES,
  endLive,
  planAnswersFor,
  savePlanAnswerFor,
  LIVE_IDLE_HOURS,
  LiveError,
  liveState,
  presentStep,
  progressFor,
  saveAnswer,
  turnIn,
} from '../lib/course'
import { courseProblems, fillSentence, findModule, parseAnswer, stepsFor, type Field } from '../lib/course-content'
import { acceptInvite, InviteError, sendInvite } from '../lib/invites'
import { projectsForUser } from '../lib/projects'
import { computePlan, parseStartingNumbers, PLAN_FIELDS, PLAN_KEY } from '../lib/plan'
import { parseRoster } from '../lib/roster'
import { prisma, reset } from './helpers'

/**
 * The training course.
 *
 * THE ONE THAT MATTERS: homework saves, and it saves for the person who wrote
 * it and nobody else. The old course could not save a worksheet at all, so
 * agents copied answers out and emailed them. Everything else here is about
 * the edges of that: answers that do not fit the question, a client reaching
 * the course, an invitation trying to make more than an agent, and the live
 * session moving only when a designer moves it.
 */

const COURSE = COURSES[0]
const WEEK_1 = 'build-your-table'
const BASE = 'https://www.dominatehomes.com'

async function person(role: Role, name = 'Test Person') {
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}-${randomBytes(4).toString('hex')}@example.invalid`, name, role },
  })
}

describe('the course content', () => {
  it('has no two questions, lessons or modules sharing a key', () => {
    for (const course of COURSES) {
      assert.deepEqual(courseProblems(course), [], `${course.slug} has problems`)
    }
  })

  it('has the six Mondays in order, with Operations and Finances sharing one', () => {
    const dates = COURSE.modules.map((unit) => unit.date)
    assert.deepEqual(dates, [...dates].sort())
    assert.equal(new Set(dates).size, 6)
    assert.equal(COURSE.modules.length, 7)
  })

  it('counts slides the same way everywhere: opening, lessons, then the worksheet', () => {
    const week1 = findModule(COURSE, WEEK_1)!
    const steps = stepsFor(week1)
    assert.equal(steps.length, 1 + week1.lessons.length + 1)
    assert.equal(steps[0].kind === 'lesson' && steps[0].isOpening, true)
    assert.equal(steps.at(-1)!.kind, 'worksheet')
  })

  it('builds the value prop sentence, showing what is still blank', () => {
    const field = findModule(COURSE, WEEK_1)!.worksheet.fields.find((f) => f.key === 'value-prop')!
    assert.equal(field.kind, 'sentence')
    if (field.kind !== 'sentence') return
    assert.equal(
      fillSentence(field, { who: 'military families', outcome: 'a smooth PCS move', where: 'Hampton Roads' }),
      'I help military families achieve a smooth PCS move in Hampton Roads, because ___.',
    )
  })
})

describe('checking an answer against its question', () => {
  const checks: Field = { kind: 'checks', key: 'c', label: 'Pick', options: ['One', 'Two'] }
  const choice: Field = { kind: 'choice', key: 'h', label: 'Pick one', options: ['Yes', 'No'] }

  it('takes ticked boxes and drops a box ticked twice', () => {
    assert.deepEqual(parseAnswer(checks, ['One', 'One', 'Two']), ['One', 'Two'])
  })

  it('refuses a box that is not on the list', () => {
    assert.throws(() => parseAnswer(checks, ['Three']), AnswerError)
  })

  it('allows a choice to be cleared, but not set to something else', () => {
    assert.equal(parseAnswer(choice, ''), '')
    assert.throws(() => parseAnswer(choice, 'Maybe'), AnswerError)
  })

  it('refuses an object where text belongs', () => {
    assert.throws(() => parseAnswer({ kind: 'long', key: 'l', label: 'L' }, { sneaky: true }), AnswerError)
  })
})

describe('saving homework', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('saves an answer and reads it back', async () => {
    const agent = await person(Role.AGENT)
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'why', 'So my kids see what work can build.')

    const answers = await answersFor(agent.id, COURSE.slug, WEEK_1)
    assert.equal(answers.why, 'So my kids see what work can build.')
  })

  it('overwrites rather than duplicating as somebody keeps typing', async () => {
    const agent = await person(Role.AGENT)
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'database-count', '4')
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'database-count', '42')

    assert.equal(await prisma.worksheetAnswer.count({ where: { userId: agent.id } }), 1)
    assert.equal((await answersFor(agent.id, COURSE.slug, WEEK_1))['database-count'], '42')
  })

  it("keeps one agent's answers out of another's", async () => {
    const amber = await person(Role.AGENT, 'Amber')
    const chris = await person(Role.AGENT, 'Chris')

    await saveAnswer(amber, COURSE.slug, WEEK_1, 'why', "Amber's why")
    await saveAnswer(chris, COURSE.slug, WEEK_1, 'why', "Chris's why")

    assert.equal((await answersFor(amber.id, COURSE.slug, WEEK_1)).why, "Amber's why")
    assert.equal((await answersFor(chris.id, COURSE.slug, WEEK_1)).why, "Chris's why")
  })

  it('will not save for a client', async () => {
    const client = await person(Role.CLIENT)
    await assert.rejects(saveAnswer(client, COURSE.slug, WEEK_1, 'why', 'hello'), AnswerError)
    assert.equal(await prisma.worksheetAnswer.count(), 0)
  })

  it('refuses a question that is not on the worksheet', async () => {
    const agent = await person(Role.AGENT)
    await assert.rejects(saveAnswer(agent, COURSE.slug, WEEK_1, 'not-a-question', 'x'), AnswerError)
    await assert.rejects(saveAnswer(agent, COURSE.slug, 'not-a-module', 'why', 'x'), AnswerError)
    await assert.rejects(saveAnswer(agent, 'not-a-course', WEEK_1, 'why', 'x'), AnswerError)
  })

  it('counts how far along somebody is', async () => {
    const agent = await person(Role.AGENT)
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'why', 'Because')
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'five-question-test', [])
    await saveAnswer(agent, COURSE.slug, WEEK_1, 'value-prop', { who: 'first-time buyers' })

    const progress = await progressFor(agent.id, COURSE)
    // An emptied list of ticks is not an answer; half a sentence is.
    assert.equal(progress[WEEK_1].answered, 2)
    assert.equal(progress[WEEK_1].total, findModule(COURSE, WEEK_1)!.worksheet.fields.length)
    assert.equal(progress[WEEK_1].turnedInAt, null)
  })
})

describe('turning homework in', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('keeps the first time it was turned in', async () => {
    const agent = await person(Role.AGENT)
    const first = await turnIn(agent, COURSE.slug, WEEK_1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await turnIn(agent, COURSE.slug, WEEK_1)

    assert.equal(second.getTime(), first.getTime())
    assert.equal(await prisma.homeworkTurnIn.count(), 1)
    assert.equal(await prisma.auditEvent.count({ where: { action: AuditAction.HOMEWORK_TURNED_IN } }), 1)
  })

  it('shows on the class roster for agents, and not for a designer trying it out', async () => {
    const agent = await person(Role.AGENT, 'Anthony Perry')
    const davina = await person(Role.DESIGNER, 'Davina Hughes')
    await turnIn(agent, COURSE.slug, WEEK_1)
    await turnIn(davina, COURSE.slug, WEEK_1)

    const roster = await classProgress(COURSE)
    assert.deepEqual(
      roster.map((row) => row.agent.name),
      ['Anthony Perry'],
    )
    assert.notEqual(roster[0].modules[WEEK_1].turnedInAt, null)
  })
})

describe('the live session', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('moves when a designer moves it, and stops when they end it', async () => {
    const davina = await person(Role.DESIGNER, 'Davina Hughes')

    assert.equal(await liveState(COURSE.slug), null)
    await presentStep(davina, COURSE.slug, WEEK_1, 2)

    const live = await liveState(COURSE.slug)
    assert.equal(live?.moduleKey, WEEK_1)
    assert.equal(live?.step, 2)
    assert.equal(live?.presenterName, 'Davina')

    await endLive(davina, COURSE.slug)
    assert.equal(await liveState(COURSE.slug), null)
  })

  it('will not let an agent move the class', async () => {
    const agent = await person(Role.AGENT)
    await assert.rejects(presentStep(agent, COURSE.slug, WEEK_1, 1), LiveError)
    await assert.rejects(endLive(agent, COURSE.slug), LiveError)
  })

  it('keeps the slide on the module', async () => {
    const davina = await person(Role.DESIGNER)
    const last = stepsFor(findModule(COURSE, WEEK_1)!).length - 1

    await presentStep(davina, COURSE.slug, WEEK_1, 99)
    assert.equal((await liveState(COURSE.slug))?.step, last)
    await presentStep(davina, COURSE.slug, WEEK_1, -4)
    assert.equal((await liveState(COURSE.slug))?.step, 0)
  })

  it('treats a session nobody has touched for hours as over', async () => {
    const davina = await person(Role.DESIGNER)
    await presentStep(davina, COURSE.slug, WEEK_1, 1)

    const later = new Date(Date.now() + (LIVE_IDLE_HOURS + 1) * 3_600_000)
    assert.equal(await liveState(COURSE.slug, later), null)
  })
})

describe('letting agents in', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  async function tokenFor(inviteId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    await prisma.invite.update({
      where: { id: inviteId },
      data: { tokenHash: createHash('sha256').update(token).digest('hex') },
    })
    return token
  }

  it('makes an agent from an agent invitation', async () => {
    const davina = await person(Role.DESIGNER, 'Davina Hughes')
    const invite = await sendInvite(davina, BASE, {
      email: 'amber@example.invalid',
      name: 'Amber Cuono',
      role: InviteRole.AGENT,
    })

    const result = await acceptInvite(await tokenFor(invite.id))
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.user.role, Role.AGENT)
  })

  it('will not put an agent on a project', async () => {
    const davina = await person(Role.DESIGNER)
    const project = await prisma.project.create({
      data: {
        slug: `p-${randomBytes(4).toString('hex')}`,
        displayName: '643 Bianca',
        community: 'Test',
        planName: 'Bianca',
        acSqFt: 2799,
        totalSqFt: 3599,
        phase: Phase.SELECTIONS,
        clientName: 'Abbie Tigges',
        designer: 'Davina Hughes',
        allocationCents: 4_700_000,
      },
    })

    await assert.rejects(
      sendInvite(davina, BASE, {
        email: 'amber@example.invalid',
        name: 'Amber',
        projectId: project.id,
        role: InviteRole.AGENT,
      }),
      InviteError,
    )
  })

  it('gives an agent no projects, so no client budget is ever in reach', async () => {
    const agent = await person(Role.AGENT)
    await prisma.project.create({
      data: {
        slug: 'p-agent-check',
        displayName: '643 Bianca',
        community: 'Test',
        planName: 'Bianca',
        acSqFt: 2799,
        totalSqFt: 3599,
        phase: Phase.SELECTIONS,
        clientName: 'Abbie Tigges',
        designer: 'Davina Hughes',
        allocationCents: 4_700_000,
      },
    })

    assert.deepEqual(await projectsForUser(agent), [])
  })

  it('still cannot be talked into a designer', () => {
    assert.deepEqual(Object.values(InviteRole).sort(), ['AGENT', 'CLIENT'])
  })

  it('reads a pasted roster in the shapes people paste it', () => {
    assert.deepEqual(
      parseRoster('Anthony Perry, anthony@example.com\n\nAmber Cuono <amber@example.com>\nChris Castle\tchris@example.com\nno address here'),
      [
        { name: 'Anthony Perry', email: 'anthony@example.com', line: 'Anthony Perry, anthony@example.com' },
        { name: 'Amber Cuono', email: 'amber@example.com', line: 'Amber Cuono <amber@example.com>' },
        { name: 'Chris Castle', email: 'chris@example.com', line: 'Chris Castle\tchris@example.com' },
        { name: 'no address here', email: '', line: 'no address here' },
      ],
    )
  })
})

describe('the 2027 plan', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('works a target back into a week, on the team model', () => {
    const n = computePlan({ closings_2026: '3', take_home: '4850', target_2027: '10', database_count: '50' })
    assert.equal(n.planClosings, 10)
    assert.equal(n.takeHomeAtTarget, 48_500)
    assert.equal(n.contracts, 13)
    assert.equal(n.agreements, 22)
    assert.equal(n.apptsMet, 37)
    assert.equal(n.apptsSet, 62)
    assert.equal(n.conversations, 104)
    assert.equal(n.conversationsPerWeek, 3)
    assert.equal(n.sphereClosings, 7)
    assert.equal(n.databaseNeeded, 88)
    assert.equal(n.databaseToAdd, 38)
  })

  it('runs on what life costs when that is more than the target', () => {
    const n = computePlan({ take_home: '5000', target_2027: '6', surviving: '$70,000', thriving: '14000', tax_rate: '30' })
    assert.equal(n.lifeClosings, 24)
    assert.equal(n.planClosings, 24)
    assert.equal(n.drivenBy, 'life')
  })

  it('never shows gross commission: there is no field for it', () => {
    assert.ok(!PLAN_FIELDS.some((field) => /gross|gci/i.test(`${field.key} ${field.label}`)))
  })

  it('keeps surviving and thriving out of what Davina is sent', async () => {
    const agent = await person(Role.AGENT)
    const davina = await person(Role.DESIGNER)
    await saveAnswer(agent, COURSE.slug, PLAN_KEY, 'surviving', '70000')
    await saveAnswer(agent, COURSE.slug, PLAN_KEY, 'my_story', 'Mine')

    const hers = await planAnswersFor(agent, davina, COURSE.slug)
    assert.equal(hers.surviving, undefined)
    assert.equal(hers.my_story, 'Mine')

    const theirs = await planAnswersFor(agent, agent, COURSE.slug)
    assert.equal(theirs.surviving, '70000')
  })

  it('lets Davina work in an agent plan, but not the private part, and nobody else at all', async () => {
    const agent = await person(Role.AGENT)
    const other = await person(Role.AGENT)
    const davina = await person(Role.DESIGNER)

    await savePlanAnswerFor(davina, agent, COURSE.slug, 'target_2027', '12')
    assert.equal((await answersFor(agent.id, COURSE.slug, PLAN_KEY)).target_2027, '12')
    assert.equal(await prisma.worksheetAnswer.count({ where: { userId: davina.id } }), 0)

    await assert.rejects(savePlanAnswerFor(davina, agent, COURSE.slug, 'surviving', '1'), AnswerError)
    await assert.rejects(savePlanAnswerFor(other, agent, COURSE.slug, 'target_2027', '99'), AnswerError)
  })

  it('reads pasted starting numbers with a name in front and no commas in the numbers', () => {
    const [line, bad] = parseStartingNumbers('Anthony Perry, perryasoldit@gmail.com, 3, 2, 0, 4850, 50, 10\nNo One, x@y.z, 1, 2')
    assert.equal(line.email, 'perryasoldit@gmail.com')
    assert.deepEqual(line.values, {
      closings2026: 3,
      listingSides: 2,
      buyerSides: 0,
      takeHome: 4850,
      databaseCount: 50,
      target2027: 10,
    })
    assert.equal(bad.values, null)
  })
})
