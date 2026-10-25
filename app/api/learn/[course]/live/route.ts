import { NextResponse, type NextRequest } from 'next/server'
import { canOpenCourses, courseBySlug, liveState } from '@/lib/course'
import { findModule, stepsFor, stepTitle } from '@/lib/course-content'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Where the presenter is, asked every few seconds by everyone following along.
 *
 * A plain poll rather than a socket. A class is a few dozen people asking a
 * question with a one-row answer, which is nothing for the server, and a poll
 * survives a phone going to sleep, a Wi-Fi blip and a deploy without anybody
 * having to reconnect anything.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ course: string }> }) {
  const user = await currentUser()
  if (!user || !canOpenCourses(user)) {
    return NextResponse.json({ error: 'Sign in to follow along.' }, { status: 401 })
  }

  const { course: slug } = await params
  const course = courseBySlug(slug)
  if (!course) return NextResponse.json({ error: 'No such course.' }, { status: 404 })

  const live = await liveState(slug)
  const unit = live ? findModule(course, live.moduleKey) : undefined
  const step = unit && live ? stepsFor(unit)[live.step] : undefined

  return NextResponse.json(
    {
      live:
        live && unit && step
          ? {
              moduleKey: unit.key,
              moduleNumber: unit.number,
              moduleTitle: unit.title,
              step: live.step,
              stepTitle: stepTitle(step),
              presenterName: live.presenterName,
            }
          : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
