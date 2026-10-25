import Link from 'next/link'
import { PlanEditor } from '@/components/course/plan-editor'
import { PageHeader } from '@/components/ui'
import { planAnswersFor, planStartFor, requireCourse } from '@/lib/course'
import { startingAnswers } from '@/lib/plan'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Your 2027 plan. Starts from your own numbers, which Davina loaded from the
 * team workbook; anything you type replaces the starting number.
 */
export default async function PlanPage({ params }: { params: Promise<{ course: string }> }) {
  const user = await requireUser()
  const { course: slug } = await params
  const course = requireCourse(user, slug)

  const [answers, start] = await Promise.all([planAnswersFor(user, user, course.slug), planStartFor(user.email)])

  return (
    <div className="space-y-8">
      <Link href={`/learn/${course.slug}`} className="text-sm text-driftwood hover:text-ink">
        {course.title}
      </Link>

      <PageHeader
        eyebrow={user.name}
        title="Your 2027 plan"
        intro={
          start
            ? 'Built on what you actually did this year. Your numbers are already in from the team workbook; change any of them that are wrong. Everything underneath works itself out as you type.'
            : 'Built on what you actually did this year. Davina has not loaded your starting numbers yet, so fill in what you know and they will be there for your next one-on-one.'
        }
      />

      <PlanEditor courseSlug={course.slug} initial={{ ...startingAnswers(start), ...answers }} mode="owner" />
    </div>
  )
}
