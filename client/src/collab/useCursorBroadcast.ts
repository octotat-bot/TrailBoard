import { useCallback, useEffect, useRef } from 'react'
import type { Awareness } from 'y-protocols/awareness'

import type { CursorPoint, PresenceState } from './presence'

export interface CursorBroadcast {
  report: (clientX: number, clientY: number) => void
  clear: () => void
}

/**
 * Publishes the local pointer position into awareness, throttled to one update
 * per animation frame.
 *
 * Positions are converted to board-canvas coordinates before broadcast. Sending
 * viewport coordinates would put a peer's cursor in the wrong place the moment
 * the two windows differed in size or scroll offset; canvas coordinates are the
 * same space the notes live in, so everyone agrees on where the pointer is.
 */
export function useCursorBroadcast(
  awareness: Awareness | null,
  canvasRef: React.RefObject<HTMLElement | null>
): CursorBroadcast {
  const frame = useRef<number | null>(null)
  const pending = useRef<CursorPoint | null>(null)

  const publish = useCallback(
    (cursor: CursorPoint | null) => {
      if (awareness === null) return
      const current = awareness.getLocalState() as PresenceState | null
      if (current === null) return
      awareness.setLocalStateField('cursor', cursor)
    },
    [awareness]
  )

  const report = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (canvas === null || awareness === null) return

      const rect = canvas.getBoundingClientRect()
      pending.current = {
        x: Math.round(clientX - rect.left),
        y: Math.round(clientY - rect.top)
      }

      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        if (pending.current !== null) publish(pending.current)
      })
    },
    [awareness, canvasRef, publish]
  )

  const clear = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    pending.current = null
    publish(null)
  }, [publish])

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  return { report, clear }
}
