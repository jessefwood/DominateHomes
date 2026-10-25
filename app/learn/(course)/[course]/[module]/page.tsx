import Link from 'next/link'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { LiveFollow } from '@/components/course/live-follow'
import { Worksheet } from '@/components/course/worksheet'
import { answersFor, requireCourse, requireModule, turnedInAt } from '@/lib/course'
import { courseDate, stepsFor, stepTitle } from '@/lib/course-content'
import { isDesigner } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * One Monday: the lessons, then the homework.
 *
 * Every section carries `data-step`, counted the same way as the presenter's
 * slides (see stepsFor), which is how following along knows what to mark.
 */
export default async function ModulePage({
  params,
}: {
  params: Promise<{ course: string; module: string }>
}) {
  const user = await requireUser()
  const { course: slug, module: key } = await params
  const course = requireCourse(user, slug)
  const unit = requireModule(course, key)
  const steps = stepsFor(unit)
  const designer = isDesigner(user)

  const [answers, turnedIn] = await Promise.all([
    answersFor(user.id, course.slug, unit.key),
    turnedInAt(user.id, course.slug, unit.key),
  ])

  const index = course.modules.indexOf(unit)
  const previous = course.modules[index - 1]
  const next = course.modules[index + 1]

  return (
    <div>
      <LiveFollow courseSlug={course.slug} moduleKey={unit.key} />

      <Link href={`/learn/${course.slug}`} className="text-sm text-driftwood hover:text-ink">
        {course.title}
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">
            Module {unit.number} · {courseDate(unit.date)}
          </p>
          <h1 className="font-display mt-1.5 text-4xl leading-tight text-ink sm:text-5xl">{unit.title}</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-driftwood-deep">{unit.goal}</p>
        </div>

        {designer ? (
          <Link
            href={`/learn/present/${course.slug}/${unit.key}`}
            className="rounded-md bg-ink px-4 py-2.5 text-sm text-page transition-opacity hover:opacity-90"
          >
            Present this module
          </Link>
        ) : null}
      </header>

      {designer && unit.draftNote ? (
        <p className="mt-5 rounded-lg bg-clay-wash px-4 py-3 text-sm leading-relaxed text-clay-deep">
          <span className="font-medium">Only you see this.</span> {unit.draftNote}
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="In this module" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 text-sm">
            {steps.map((step, number) => (
              <li key={number}>
                <a
                  href={`#step-${number}`}
                  className="block rounded-md px-2.5 py-1.5 text-driftwood-deep hover:bg-oyster hover:text-ink"
                >
                  {stepTitle(step)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {steps.map((step, number) =>
            step.kind === 'lesson' ? (
              <section
                key={number}
                id={`step-${number}`}
                data-step={number}
                className="hairline rounded-xl border bg-page p-6 shadow-sheet sm:p-8"
              >
                <p className="eyebrow">{step.isOpening ? 'Before we start' : `Lesson ${number + (unit.opening ? 0 : 1)}`}</p>
                <h2 className="font-display mt-1 mb-5 text-2xl leading-tight text-ink sm:text-3xl">
                  {step.lesson.title}
                </h2>
                <LessonBlocks blocks={step.lesson.blocks} />
              </section>
            ) : (
              <section
                key={number}
                id={`step-${number}`}
                data-step={number}
                className="rounded-xl border-2 border-ink bg-page p-6 sm:p-8"
              >
                <p className="eyebrow">Homework · due {courseDate(step.worksheet.due)}</p>
                <h2 className="font-display mt-1 mb-6 text-2xl leading-tight text-ink sm:text-3xl">
                  {step.worksheet.title}
                </h2>
                <Worksheet
                  courseSlug={course.slug}
                  moduleKey={unit.key}
                  fields={step.worksheet.fields}
                  initial={answers}
                  turnedInAt={turnedIn?.toISOString() ?? null}
                  due={courseDate(step.worksheet.due)}
                />
              </section>
            ),
          )}

          <div className="flex flex-wrap justify-between gap-4 pt-4 text-sm">
            {previous ? (
              <Link href={`/learn/${course.slug}/${previous.key}`} className="text-driftwood-deep hover:text-ink">
                ← Module {previous.number}, {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/learn/${course.slug}/${next.key}`} className="text-driftwood-deep hover:text-ink">
                Module {next.number}, {next.title} →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
