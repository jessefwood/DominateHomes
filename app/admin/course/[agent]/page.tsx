import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Role } from '@prisma/client'
import { PrintButton } from '@/components/course/print-button'
import { WorkbookView } from '@/components/course/workbook-view'
import { PageHeader } from '@/components/ui'
import { allAnswersFor, COURSES } from '@/lib/course'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** One agent's homework, every week, exactly as they wrote it. */
export default async function AgentWorkbookPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: id } = await params
  const course = COURSES[0]

  const agent = await prisma.user.findUnique({ where: { id } })
  if (!agent || agent.role !== Role.AGENT) notFound()

  const [answers, turnIns] = await Promise.all([
    allAnswersFor(agent.id, course.slug),
    prisma.homeworkTurnIn.findMany({ where: { userId: agent.id, courseSlug: course.slug } }),
  ])

  return (
    <div className="space-y-10">
      <Link href="/admin/course" className="text-sm text-driftwood hover:text-ink print:hidden">
        ← The class
      </Link>

      <PageHeader eyebrow={agent.email} title={agent.name} intro={`${course.title}, everything so far.`} actions={
          <>
            <Link
              href={`/admin/course/${agent.id}/plan`}
              className="hairline rounded-md border px-4 py-2 text-sm text-ink transition-colors hover:bg-oyster print:hidden"
            >
              2027 plan
            </Link>
            <PrintButton />
          </>
        }
      />

      <WorkbookView
        course={course}
        answers={answers}
        turnIns={Object.fromEntries(turnIns.map((row) => [row.moduleKey, row.turnedInAt]))}
      />
    </div>
  )
}
