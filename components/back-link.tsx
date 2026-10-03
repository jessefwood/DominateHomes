'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Back.
 *
 * `router.back()` and not a fixed href, because the useful meaning of back is
 * wherever you actually came from. Opening a room from the dashboard and from
 * the room list should both go back where you were, and a parent link only
 * gets one of those right.
 *
 * It renders nothing until the component has mounted and there is somewhere to
 * go back to. A browser opened straight on this URL has no history inside the
 * site, and a back button that lands on whatever tab was there before is worse
 * than no back button. `fallbackHref` is the answer for the case where there
 * is no history but there is an obvious parent, which is most of the portal.
 */
export function BackLink({
  fallbackHref,
  label = 'Back',
  className = '',
}: {
  fallbackHref?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    // Set on the client only: there is no history on the server, and reading
    // it during render would differ between the two and hydrate wrong.
    setHasHistory(window.history.length > 1)
  }, [])

  const classes = `inline-flex items-center gap-1.5 text-sm text-driftwood transition-colors hover:text-ink ${className}`

  const arrow = (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  if (!hasHistory) {
    if (!fallbackHref) return null
    return (
      <a href={fallbackHref} className={classes}>
        {arrow}
        {label}
      </a>
    )
  }

  return (
    <button type="button" onClick={() => router.back()} className={classes}>
      {arrow}
      {label}
    </button>
  )
}
