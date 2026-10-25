import Link from 'next/link'
import { Card, PageHeader, Pill } from '@/components/ui'
import { LiveFollow } from '@/components/course/live-follow'
import { progressFor, requireCourse, type ModuleProgress } from '@/lib/course'
import { courseDate } from '@/lib/course-content'
import { isDesigner } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

function HomeworkPill({ progress }: { progress: ModuleProgress }) {
  if (progress.turnedInAt) return <Pill tone="sea">Turned in</Pill>
  if (progress.answered === 0) return <Pill>Not started</Pill>
  return (
    <Pill tone="clay">
      {progress.answered} of {progress.total} answered
    </Pill>
  )
}

/**
 * The course at a glance: the six Mondays in order, and where your homework
 * stands on each. Seven modules, because Operations and Finances share a
 * Monday.
 */
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const user = await requireUser()
  const { course: slug } = await params
  const course = requireCourse(user, slug)
  const progress = await progressFor(user.id, course)
  const designer = isDesigner(user)

  return (
    <div className="space-y-10">
      <LiveFollow courseSlug={course.slug} />

      <PageHeader
        eyebrow={`Hi ${user.name.split(' ')[0]}`}
        title={course.title}
        intro={`${course.tagline} One module every Monday. The lesson is here to come back to, and the homework is filled in right on the page and saves as you go.`}
        actions={
          <Link
            href={`/learn/${course.slug}/workbook`}
            className="hairline rounded-md border px-4 py-2 text-sm text-ink transition-colors hover:bg-oyster"
          >
            {designer ? 'Your test workbook' : 'Your workbook'}
          </Link>
        }
      />

      <ol className="space-y-4">
        {course.modules.map((unit) => (
          <li key={unit.key}>
            <Card href={`/learn/${course.slug}/${unit.key}`} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                <span className="font-display text-4xl leading-none text-seaglass">{unit.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{courseDate(unit.date)}</p>
                  <h2 className="font-display mt-1 text-2xl leading-tight text-ink">{unit.title}</h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-driftwood-deep">{unit.goal}</p>
                  {designer && unit.draftNote ? (
                    <p className="mt-3 text-sm leading-relaxed text-clay-deep">
                      <span className="font-medium">Only you see this.</span> {unit.draftNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <HomeworkPill progress={progress[unit.key]} />
                  <span className="text-xs text-driftwood">Due {courseDate(unit.worksheet.due)}</span>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}
