import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Long enough for the arrival animation to finish, then the class comes off. */
const FRESH_MS = 700

/**
 * Ids of notes that have appeared since this board was opened.
 *
 * Used to animate an arrival, and the distinction is the whole point: notes
 * that were already on the board when you opened it should simply be there. If
 * every note animated on mount, a busy board would detonate into forty
 * simultaneous animations on every reload. Only notes that genuinely arrive
 * while someone is watching are worth announcing.
 */
export function useFreshNotes(ids: readonly string[]): ReadonlySet<string> {
  // Null until the first pass, which is what distinguishes "the board loaded
  // with these notes" from "these notes arrived".
  const known = useRef<Set<string> | null>(null)
  const timers = useRef(new Map<string, number>())
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())

  /*
   * A layout effect, not a plain one. Marking a note as fresh is a state update,
   * so it lands one render after the note first appears; with a passive effect
   * the browser paints the note in its settled state and only then starts the
   * arrival animation, which shows up as a flicker. A layout effect forces that
   * second render to happen before paint, so the note's first painted frame is
   * already the start of the animation.
   */
  useLayoutEffect(() => {
    if (known.current === null) {
      known.current = new Set(ids)
      return
    }

    const seen = known.current
    const arrived = ids.filter((id) => !seen.has(id))

    // Drop ids that have gone, so that undoing a delete reads as an arrival
    // rather than the note blinking back with no acknowledgement.
    const live = new Set(ids)
    for (const id of seen) if (!live.has(id)) seen.delete(id)
    for (const id of arrived) seen.add(id)

    if (arrived.length === 0) return
    setFresh((prev) => new Set([...prev, ...arrived]))

    for (const id of arrived) {
      const pending = timers.current.get(id)
      if (pending !== undefined) window.clearTimeout(pending)

      timers.current.set(
        id,
        window.setTimeout(() => {
          timers.current.delete(id)
          setFresh((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }, FRESH_MS)
      )
    }
  }, [ids])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer)
      pending.clear()
    }
  }, [])

  return fresh
}
