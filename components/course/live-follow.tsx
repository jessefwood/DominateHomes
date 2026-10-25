'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * Following Davina while she teaches.
 *
 * When she is presenting this module, the section she is on is marked on the
 * agent's own page and, unless they have switched it off, scrolled into view
 * as she moves. When she is presenting a different module, a bar says where
 * she is and takes them there. When she is not presenting, it draws nothing.
 *
 * The page itself is ordinary: following along changes what is highlighted,
 * never what is typed. Somebody halfway through an answer is not scrolled
 * away from it; see the focus check below.
 */

type Live = {
  moduleKey: string
  moduleNumber: number
  moduleTitle: string
  step: number
  stepTitle: string
  presenterName: string
}

const POLL_MS = 3000

export function LiveFollow({ courseSlug, moduleKey }: { courseSlug: string; moduleKey?: string }) {
  const [live, setLive] = useState<Live | null>(null)
  const [following, setFollowing] = useState(true)
  const lastStep = useRef<string | null>(null)

  useEffect(() => {
    let stopped = false

    async function ask() {
      try {
        const response = await fetch(`/api/learn/${courseSlug}/live`, { cache: 'no-store' })
        if (!response.ok) return
        const body = (await response.json()) as { live: Live | null }
        if (!stopped) setLive(body.live)
      } catch {
        // A missed poll is not worth telling anybody about. The next one in
        // three seconds will either work or keep quietly trying.
      }
    }

    void ask()
    const timer = setInterval(ask, POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [courseSlug])

  const here = Boolean(live && moduleKey && live.moduleKey === moduleKey)

  // Mark the section she is on, and bring it into view when it changes.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-step]')
    sections.forEach((section) => section.removeAttribute('data-live'))
    if (!here || !live) {
      lastStep.current = null
      return
    }

    const current = document.querySelector<HTMLElement>(`[data-step="${live.step}"]`)
    current?.setAttribute('data-live', 'true')

    const id = `${live.moduleKey}:${live.step}`
    if (following && current && lastStep.current !== id) {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
      if (!typing) current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    lastStep.current = id
  }, [here, live, following])

  if (!live) return null

  return (
    <div className="sticky top-[57px] z-40 -mx-4 mb-6 bg-seaglass-deep px-4 py-2.5 text-sm text-page sm:mx-0 sm:rounded-lg print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-2 font-medium">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-page opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-page" />
          </span>
          {live.presenterName} is live
        </span>

        {here ? (
          <>
            <span className="opacity-90">Now: {live.stepTitle}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setFollowing((was) => !was)}
              className="rounded-md border border-page/40 px-2.5 py-1 text-xs hover:bg-page/10"
            >
              {following ? 'Stop following' : 'Follow along'}
            </button>
          </>
        ) : (
          <>
            <span className="opacity-90">
              Module {live.moduleNumber}, {live.moduleTitle}
            </span>
            <span className="flex-1" />
            <Link
              href={`/learn/${courseSlug}/${live.moduleKey}`}
              className="rounded-md bg-page px-3 py-1 text-xs font-medium text-seaglass-deep hover:opacity-90"
            >
              Join her there
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
