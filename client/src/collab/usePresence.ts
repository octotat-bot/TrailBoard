import { useMemo, useSyncExternalStore } from 'react'
import type { Awareness } from 'y-protocols/awareness'

import {
  readPresenceUsers,
  readRemoteCursors,
  type PresenceUser,
  type RemoteCursor
} from './presence'

const NO_USERS: PresenceUser[] = []
const NO_CURSORS: RemoteCursor[] = []

/**
 * Awareness fires `change` on every cursor movement of every peer — dozens of
 * events a second on a busy board. The presence bar only cares about *who* is
 * here, so this keeps the previous array whenever the roster is unchanged, and
 * React skips the render entirely.
 */
export function usePresenceUsers(awareness: Awareness | null): PresenceUser[] {
  const store = useMemo(() => {
    let snapshot: PresenceUser[] = awareness === null ? NO_USERS : readPresenceUsers(awareness)

    const sameRoster = (a: PresenceUser[], b: PresenceUser[]): boolean =>
      a.length === b.length &&
      a.every((user, i) => {
        const other = b[i]
        return (
          other !== undefined &&
          user.clientId === other.clientId &&
          user.name === other.name &&
          user.color === other.color
        )
      })

    return {
      subscribe(onChange: () => void) {
        if (awareness === null) return () => {}
        const handler = () => {
          const next = readPresenceUsers(awareness)
          if (sameRoster(next, snapshot)) return
          snapshot = next
          onChange()
        }
        awareness.on('change', handler)
        return () => awareness.off('change', handler)
      },
      getSnapshot: () => snapshot
    }
  }, [awareness])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** Remote cursor positions. This one genuinely does change on every movement. */
export function useRemoteCursors(awareness: Awareness | null): RemoteCursor[] {
  const store = useMemo(() => {
    let snapshot: RemoteCursor[] = awareness === null ? NO_CURSORS : readRemoteCursors(awareness)

    return {
      subscribe(onChange: () => void) {
        if (awareness === null) return () => {}
        const handler = () => {
          snapshot = readRemoteCursors(awareness)
          onChange()
        }
        awareness.on('change', handler)
        return () => awareness.off('change', handler)
      },
      getSnapshot: () => snapshot
    }
  }, [awareness])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
