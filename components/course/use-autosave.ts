'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { runAction, type ActionResult } from '@/lib/client-action'

/**
 * Saving as people type, shared by the weekly worksheets and the 2027 plan.
 *
 * Each answer saves a moment after typing stops, and straight away when the
 * person leaves the box. A failed save keeps the value queued, so the next
 * keystroke or the next box left tries again rather than losing it. Closing
 * the tab with something unsaved asks first.
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 700

export function useAutosave(
  initial: Record<string, unknown>,
  save: (key: string, value: unknown) => Promise<ActionResult>,
) {
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [problem, setProblem] = useState<string | null>(null)

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const unsaved = useRef(new Map<string, unknown>())
  const inFlight = useRef(0)

  const send = useCallback(
    async (key: string) => {
      if (!unsaved.current.has(key)) return
      const value = unsaved.current.get(key)
      unsaved.current.delete(key)

      inFlight.current += 1
      setStatus('saving')
      const result = await runAction(() => save(key, value))
      inFlight.current -= 1

      if (result.error) {
        if (!unsaved.current.has(key)) unsaved.current.set(key, value)
        setProblem(result.error)
        setStatus('error')
        return
      }

      if (inFlight.current === 0 && unsaved.current.size === 0) {
        setProblem(null)
        setStatus('saved')
      }
    },
    [save],
  )

  const change = useCallback(
    (key: string, value: unknown) => {
      setValues((was) => ({ ...was, [key]: value }))
      unsaved.current.set(key, value)
      setStatus('saving')

      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          void send(key)
        }, SAVE_DELAY_MS),
      )
    },
    [send],
  )

  const flush = useCallback(
    (key: string) => {
      const existing = timers.current.get(key)
      if (existing) {
        clearTimeout(existing)
        timers.current.delete(key)
      }
      void send(key)
    },
    [send],
  )

  const flushAll = useCallback(() => {
    for (const key of [...unsaved.current.keys()]) flush(key)
  }, [flush])

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (unsaved.current.size > 0 || inFlight.current > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  return { values, change, flush, flushAll, status, problem, setProblem }
}

/** The line at the top that always says whether what is on screen has reached us. */
export function statusLabel(status: SaveStatus): string {
  return status === 'saving' ? 'Saving' : status === 'error' ? 'Not saved yet' : status === 'saved' ? 'Saved' : 'Up to date'
}
