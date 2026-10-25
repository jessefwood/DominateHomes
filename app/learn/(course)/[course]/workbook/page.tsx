import Link from 'next/link'
import { PrintButton } from '@/components/course/print-button'
import { WorkbookView } from '@/components/course/workbook-view'
import { PageHeader } from '@/components/ui'
import { allAnswersFor, requireCourse } from '@/lib/course'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** Every answer you have written, in one place, ready to print. */
export default async function WorkbookPage({ params }: { params: Promise<{ course: string }> }) {
  const user = await requireUser()
  const { course: slug } = await params
  const course = requireCourse(user, slug)

  const [answers, turnIns] = await Promise.all([
    allAnswersFor(user.id, course.slug),
    prisma.homeworkTurnIn.findMany({ where: { userId: user.id, courseSlug: course.slug } }),
  ])

  return (
    <div className="space-y-10">
      <Link href={`/learn/${course.slug}`} className="text-sm text-driftwood hover:text-ink print:hidden">
        {course.title}
      </Link>

      <PageHeader
        eyebrow={user.name}
        title="Your workbook"
        intro="Everything you have written so far, every week. To change an answer, open that module; it saves there and shows up here."
        actions={<PrintButton />}
      />

      <WorkbookView
        course={course}
        answers={answers}
        turnIns={Object.fromEntries(turnIns.map((row) => [row.moduleKey, row.turnedInAt]))}
      />
    </div>
  )
}
