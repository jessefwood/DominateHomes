import { notFound } from 'next/navigation'
import { courseBySlug, liveState } from '@/lib/course'
import { findModule, stepsFor } from '@/lib/course-content'
import { requireDesigner } from '@/lib/session'
import { Presenter } from './presenter'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * Davina's screen for teaching a module. Two ways to open it:
 *
 *   the presenter view, with her notes and what is coming next, which she
 *   keeps on her own screen; and
 *
 *   ?view=screen, the slide and nothing else, which she shares in Zoom. It
 *   follows the presenter view in the same browser without going through
 *   the server, so it keeps up even when nobody is live.
 */
export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ course: string; module: string }>
  searchParams: Promise<{ view?: string }>
}) {
  await requireDesigner()
  const { course: slug, module: key } = await params
  const { view } = await searchParams

  const course = courseBySlug(slug)
  const unit = course ? findModule(course, key) : undefined
  if (!course || !unit) notFound()

  const live = await liveState(course.slug)

  return (
    <Presenter
      courseSlug={course.slug}
      courseTitle={course.title}
      moduleKey={unit.key}
      moduleNumber={unit.number}
      moduleTitle={unit.title}
      goal={unit.goal}
      steps={stepsFor(unit)}
      screenOnly={view === 'screen'}
      liveHere={live?.moduleKey === unit.key}
      startAt={live?.moduleKey === unit.key ? live.step : 0}
    />
  )
}
