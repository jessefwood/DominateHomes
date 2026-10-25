import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Role } from '@prisma/client'
import { PlanEditor } from '@/components/course/plan-editor'
import { PageHeader } from '@/components/ui'
import { answersFor, COURSES, planStartFor } from '@/lib/course'
import { prisma } from '@/lib/db'
import { computePlan, PLAN_KEY, startingAnswers, withoutPrivate } from '@/lib/plan'

export const dynamic = 'force-dynamic'

/**
 * An agent's 2027 plan, for working on it together.
 *
 * The private answers are read here only to work out how many closings they
 * add up to. The answers themselves are stripped before anything is sent to
 * the browser.
 */
export default async function AgentPlanPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: id } = await params
  const course = COURSES[0]

  const agent = await prisma.user.findUnique({ where: { id } })
  if (!agent || agent.role !== Role.AGENT) notFound()

  const [answers, start] = await Promise.all([answersFor(agent.id, course.slug, PLAN_KEY), planStartFor(agent.email)])
  const full = { ...startingAnswers(start), ...answers }
  const lifeClosings = computePlan(full).lifeClosings

  return (
    <div className="space-y-8">
      <Link href={`/admin/course/${agent.id}`} className="text-sm text-driftwood hover:text-ink">
        ← {agent.name}&apos;s homework
      </Link>

      <PageHeader
        eyebrow={agent.name}
        title="2027 plan"
        intro={
          start
            ? 'Their starting numbers are loaded. Fill in anything with them; the surviving and thriving section stays theirs.'
            : 'No starting numbers loaded for this address yet. Load them on the starting numbers page and they appear here.'
        }
      />

      <PlanEditor
        courseSlug={course.slug}
        initial={withoutPrivate(full)}
        mode="designer"
        agentId={agent.id}
        agentName={agent.name}
        lifeClosings={lifeClosings}
      />
    </div>
  )
}
