import { useMemo, useSyncExternalStore } from 'react'

import type { NotesMap } from './notes'
import { CANVAS_PADDING, CANVAS_STEP, NOTE_MIN_HEIGHT, NOTE_WIDTH } from '../theme/layout'

export interface CanvasExtent {
  width: number
  height: number
}

const roundUp = (value: number): number => Math.ceil(value / CANVAS_STEP) * CANVAS_STEP

/**
 * How large the scrollable canvas needs to be to contain every note.
 *
 * Note coordinates are absolute and never derived from the window size, which is
 * what keeps positions stable across a resize. The trade-off is that a note
 * parked at x=1800 on a wide monitor would sit outside a narrow window, so the
 * canvas grows to cover the furthest note and the board scrolls to reach it.
 *
 * The result is quantised to CANVAS_STEP so that dragging a note rightwards does
 * not resize the container on every frame — the snapshot keeps its identity until
 * it crosses a step boundary, so React skips the re-render entirely.
 */
export function useCanvasExtent(notes: NotesMap | null): CanvasExtent {
  const store = useMemo(() => {
    let snapshot: CanvasExtent = { width: 0, height: 0 }

    const read = (): CanvasExtent => {
      let maxX = 0
      let maxY = 0

      notes?.forEach((yNote) => {
        const x = yNote.get('x')
        const y = yNote.get('y')
        if (typeof x === 'number' && x > maxX) maxX = x
        if (typeof y === 'number' && y > maxY) maxY = y
      })

      const next = {
        width: roundUp(maxX + NOTE_WIDTH + CANVAS_PADDING),
        height: roundUp(maxY + NOTE_MIN_HEIGHT + CANVAS_PADDING)
      }

      // Preserve reference identity when nothing meaningful changed.
      return next.width === snapshot.width && next.height === snapshot.height ? snapshot : next
    }

    snapshot = read()

    return {
      subscribe(onChange: () => void) {
        if (notes === null) return () => {}
        const handler = () => {
          const next = read()
          if (next === snapshot) return
          snapshot = next
          onChange()
        }
        notes.observeDeep(handler)
        return () => notes.unobserveDeep(handler)
      },
      getSnapshot: () => snapshot
    }
  }, [notes])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
