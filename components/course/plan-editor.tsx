'use client'

import { useCallback } from 'react'
import { saveAnswerAction } from '@/app/learn/(course)/[course]/actions'
import { savePlanForAction } from '@/app/admin/course/actions'
import { computePlan, PLAN_KEY, PLAN_SECTIONS, TEAM_MODEL, type PlanNumbers } from '@/lib/plan'
import { FieldInput } from './field-input'
import { SaveBar } from './save-bar'
import { useAutosave } from './use-autosave'

/**
 * The 2027 plan, worked through on one page.
 *
 * Every number underneath a section recalculates as the agent types, from
 * the same arithmetic the server uses (lib/plan.ts). Two ways in:
 *
 *   the agent's own plan, where everything is theirs to fill in, including
 *   the private section; and
 *
 *   Davina's view of it, where she can fill in anything with them except
 *   the private section, which never reaches her browser. She sees only how
 *   many closings it adds up to, worked out on the server.
 */

const money = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const whole = (value: number) => Math.round(value).toLocaleString('en-US')
const oneDecimal = (value: number) => (Math.round(value * 10) / 10).toLocaleString('en-US')

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hairline grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b py-3 last:border-b-0">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className="font-display text-2xl text-seaglass-deep tabular-nums">{value}</span>
      {note ? <span className="col-span-2 mt-0.5 text-sm leading-relaxed text-driftwood">{note}</span> : null}
    </div>
  )
}

function Worked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg bg-oyster/70 px-5 py-2">
      <p className="eyebrow pt-3">{title}</p>
      {children}
    </div>
  )
}

function TakesSection({ n }: { n: PlanNumbers }) {
  return (
    <section className="hairline rounded-xl border bg-page p-6 shadow-sheet sm:p-8">
      <p className="eyebrow">Worked out for you</p>
      <h2 className="font-display mt-1 text-2xl text-ink sm:text-3xl">What your number takes</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-driftwood-deep">
        Your plan runs on {whole(n.planClosings)} closings, worked backward with the team&apos;s numbers: six in ten at
        every stage, one in five contracts falling apart, {TEAM_MODEL.workingWeeks} working weeks, and seventy percent of
        your business from your sphere.
      </p>

      {n.planClosings > 0 ? (
        <p className="mt-5 rounded-lg border-l-4 border-seaglass-deep bg-seaglass-wash px-5 py-4 font-display text-xl leading-snug text-ink">
          Your year is {whole(n.planClosings)} closings. That is {whole(n.conversationsPerWeek)} conversations a week and{' '}
          {whole(n.databaseToAddPerWeek)} new {n.databaseToAddPerWeek === 1 ? 'person' : 'people'} in your database a week.
        </p>
      ) : null}

      <Worked title="The funnel">
        <Row label="Contracts you need to write" value={whole(n.contracts)} />
        <Row label="Signed agreements" value={whole(n.agreements)} />
        <Row label="Appointments you actually sit" value={whole(n.apptsMet)} />
        <Row label="Appointments you set" value={whole(n.apptsSet)} />
        <Row label="Real conversations in the year" value={whole(n.conversations)} />
        <Row label="Conversations a week" value={whole(n.conversationsPerWeek)} />
        <Row label="Which is this many a day" value={oneDecimal(n.conversationsPerDay)} />
      </Worked>

      <Worked title="Your database">
        <Row label="Closings from your sphere" value={whole(n.sphereClosings)} />
        <Row label="And from lead sources" value={whole(n.leadClosings)} />
        <Row
          label="People your sphere closings need"
          value={whole(n.databaseNeeded)}
          note={`At ${TEAM_MODEL.spherePerHundred} closings a year for every hundred people you work.`}
        />
        <Row label="People you have to add" value={whole(n.databaseToAdd)} />
        <Row label="Which is this many a week" value={whole(n.databaseToAddPerWeek)} />
      </Worked>
    </section>
  )
}

export function PlanEditor({
  courseSlug,
  initial,
  mode,
  agentId,
  agentName,
  lifeClosings,
}: {
  courseSlug: string
  initial: Record<string, unknown>
  mode: 'owner' | 'designer'
  /** Designer mode: whose plan this is. */
  agentId?: string
  agentName?: string
  /** Designer mode: what the private section adds up to, worked out on the server. */
  lifeClosings?: number | null
}) {
  const save = useCallback(
    (key: string, value: unknown) =>
      mode === 'owner'
        ? saveAnswerAction(courseSlug, PLAN_KEY, key, value)
        : savePlanForAction(agentId ?? '', key, value),
    [mode, courseSlug, agentId],
  )
  const { values, change, flush, status, problem } = useAutosave(initial, save)

  const n = computePlan(values, mode === 'designer' ? (lifeClosings ?? null) : undefined)
  const first = agentName?.split(' ')[0] ?? 'They'

  return (
    <div className="space-y-6 pb-28">
      <SaveBar
        status={status}
        problem={problem}
        note={mode === 'owner' ? 'Your plan saves as you type. Davina can see it, except the private part.' : `You are working in ${first}'s plan. It saves as you type.`}
      />

      {PLAN_SECTIONS.map((section) => (
        <div key={section.key} className="space-y-6">
          <section
            className={`rounded-xl border p-6 sm:p-8 ${section.private ? 'border-private-soft bg-private-wash' : 'hairline bg-page shadow-sheet'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl text-ink sm:text-3xl">{section.title}</h2>
              {section.private ? (
                <span className="rounded-full bg-private-soft px-2.5 py-0.5 text-xs font-medium tracking-wide text-private">
                  Private to {mode === 'owner' ? 'you' : first}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-driftwood-deep">{section.intent}</p>

            {section.private && mode === 'designer' ? (
              <p className="mt-5 text-[15px] leading-relaxed text-ink">
                {lifeClosings
                  ? `${first} has filled this in. What their life costs works out to ${whole(lifeClosings)} closings, so the plan runs on ${whole(n.planClosings)}.`
                  : `${first} has not filled this in yet. Until they do, the plan runs on the target.`}
              </p>
            ) : (
              <ol className="mt-6 space-y-6">
                {section.fields.map((field) => (
                  <li key={field.key}>
                    <p className="text-[15px] font-medium leading-snug text-ink">{field.label}</p>
                    {field.help ? <p className="mt-1 text-sm leading-relaxed text-driftwood">{field.help}</p> : null}
                    <FieldInput
                      field={field}
                      value={values[field.key]}
                      onChange={(next) => change(field.key, next)}
                      onCommit={() => flush(field.key)}
                    />
                  </li>
                ))}
              </ol>
            )}

            {section.key === 'number' ? (
              <Worked title="Worked out">
                <Row label="Take-home at your target" value={money(n.takeHomeAtTarget)} note="Your target times what you take home on an average closing." />
                <Row label="More closings than 2026" value={whole(n.extraClosings)} />
                <Row label="Extra closings a month" value={oneDecimal(n.extraPerMonth)} />
              </Worked>
            ) : null}

            {section.key === 'life' && mode === 'owner' ? (
              <Worked title="Worked out">
                <Row label="What you need to land this year" value={n.lifeNeedsAfterTax === null ? '—' : money(n.lifeNeedsAfterTax)} />
                <Row label="So you have to earn this before tax" value={n.lifeNeedsBeforeTax === null ? '—' : money(n.lifeNeedsBeforeTax)} />
                <Row label="Closings your life costs" value={n.lifeClosings === null ? '—' : whole(n.lifeClosings)} />
                <Row
                  label="Your plan runs on"
                  value={whole(n.planClosings)}
                  note={
                    n.drivenBy === 'life'
                      ? 'What your life costs. Your target does not cover it, so the number has to go up.'
                      : 'Your target. It clears what your life costs, which is where you want to be.'
                  }
                />
              </Worked>
            ) : null}
          </section>

          {section.key === 'life' ? <TakesSection n={n} /> : null}
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-40 bg-ink text-page print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-1 px-4 py-3 sm:px-8">
          {[
            ['Closings', whole(n.planClosings)],
            ['Take-home', money(n.planClosings * n.takeHome)],
            ['Conversations a week', whole(n.conversationsPerWeek)],
            ['New people a week', whole(n.databaseToAddPerWeek)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] tracking-[0.14em] text-page/60 uppercase">{label}</p>
              <p className="font-display text-xl tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
