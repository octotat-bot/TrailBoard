import { useEffect, useRef, useState } from 'react'

import type { RemoteCursor } from './presence'

export interface TrailDot {
  /** Monotonic, used only as a React key so a dot's fade never restarts. */
  id: number
  x: number
  y: number
  bornAt: number
}

/** How long a dot takes to fade out completely. Mirrors --trail-life in board.css. */
const TRAIL_LIFE_MS = 400

/** Minimum gap between dots, so a fast flick leaves a dotted path, not a smear. */
const SPACING_PX = 24

/**
 * Dots are also rationed in time, not just distance. Since opacity is a function
 * of a dot's age, gating on distance alone means a fast pointer lays all four
 * down within a few frames and they are all still bright — a bunched, uniform
 * clump. One dot per fifth of the trail's life spreads four of them evenly across
 * the fade, which is what produces the 0.6-to-0.1 ramp at any pointer speed while
 * still keeping the dot nearest the pointer freshly inked.
 */
const MIN_INTERVAL_MS = TRAIL_LIFE_MS / 5

/** Four is enough to read as a stroke; more starts to look like a comet. */
const MAX_DOTS = 4

export type Trails = Map<number, TrailDot[]>

const EMPTY: Trails = new Map()

/**
 * Keeps a short rolling buffer of recent positions per remote cursor, which the
 * cursor layer renders as fading dots behind the pointer.
 *
 * The fade itself is a CSS animation, not a per-frame React update. That choice
 * matters: driving four dots per user through React at sixty frames a second
 * would re-render the cursor layer constantly for something the compositor can do
 * on its own. Here React only runs when the pointer has travelled far enough to
 * deserve a new dot, and each dot fades independently from the moment it is born.
 *
 * The visual gradient falls out of that for free. Dots are laid down along the
 * path and all fade over the same 400ms, so at any instant the newest sits near
 * 0.6 opacity and the oldest is close to 0.1 — a marker stroke drying behind the
 * pen, without anyone computing a gradient.
 */
export function useCursorTrails(cursors: RemoteCursor[], enabled: boolean): Trails {
  const [trails, setTrails] = useState<Trails>(EMPTY)
  const buffers = useRef<Trails>(new Map())
  const lastPoint = useRef(new Map<number, { x: number; y: number }>())
  const nextId = useRef(0)
  const sweep = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const now = performance.now()
    const live = new Set(cursors.map((c) => c.clientId))
    const notExpired = (dot: TrailDot) => now - dot.bornAt < TRAIL_LIFE_MS
    let changed = false

    // The buffer is advanced here in the effect body rather than inside a
    // setState updater. Updaters must be pure — React double-invokes them in
    // StrictMode, and a second pass over this logic would see the position it
    // just recorded, measure zero travel, and drop the dot on the floor.
    for (const clientId of [...buffers.current.keys()]) {
      // Peer left, or their pointer went off-board.
      if (!live.has(clientId)) {
        buffers.current.delete(clientId)
        lastPoint.current.delete(clientId)
        changed = true
      }
    }

    for (const cursor of cursors) {
      const previous = lastPoint.current.get(cursor.clientId)

      if (previous === undefined) {
        lastPoint.current.set(cursor.clientId, { x: cursor.x, y: cursor.y })
        continue
      }

      const dots = buffers.current.get(cursor.clientId) ?? []
      // Expire before appending, so a paused pointer sheds its trail.
      const alive = dots.filter(notExpired)
      const travelled = Math.hypot(cursor.x - previous.x, cursor.y - previous.y)
      const sinceLastDot = now - (alive[alive.length - 1]?.bornAt ?? -Infinity)

      if (travelled < SPACING_PX || sinceLastDot < MIN_INTERVAL_MS) {
        if (alive.length !== dots.length) {
          buffers.current.set(cursor.clientId, alive)
          changed = true
        }
        continue
      }

      lastPoint.current.set(cursor.clientId, { x: cursor.x, y: cursor.y })
      nextId.current += 1

      // The dot is dropped at the *previous* sample, so it sits behind the head.
      const dot: TrailDot = { id: nextId.current, x: previous.x, y: previous.y, bornAt: now }
      buffers.current.set(cursor.clientId, [...alive, dot].slice(-MAX_DOTS))
      changed = true
    }

    // Fresh Map identity so useSyncExternalStore-free consumers still re-render.
    if (changed) setTrails(new Map(buffers.current))
  }, [cursors, enabled])

  // A stationary pointer produces no awareness updates, so nothing above would
  // ever run again to clear the faded-out dots. This sweeps them from the DOM.
  useEffect(() => {
    if (!enabled || trails.size === 0) return

    if (sweep.current !== null) window.clearTimeout(sweep.current)
    sweep.current = window.setTimeout(() => {
      buffers.current.clear()
      setTrails(EMPTY)
    }, TRAIL_LIFE_MS + 80)

    return () => {
      if (sweep.current !== null) window.clearTimeout(sweep.current)
    }
  }, [trails, enabled])

  useEffect(() => {
    if (!enabled) {
      buffers.current.clear()
      lastPoint.current.clear()
      setTrails(EMPTY)
    }
  }, [enabled])

  return enabled ? trails : EMPTY
}
