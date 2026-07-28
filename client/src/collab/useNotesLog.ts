import { useEffect } from 'react'
import * as Y from 'yjs'

import { readAllNotes, type NotesMap } from './notes'

/**
 * Phase 2 verification aid: narrates every change to the notes map in the console
 * so two tabs can be compared side by side.
 *
 * `observeDeep` rather than `observe` because notes are nested Y.Maps — a plain
 * `observe` on the root only fires when a note is added or removed, and would
 * stay silent while a note's own fields change.
 *
 * `transaction.local` is the useful bit: it separates changes this tab made from
 * changes that arrived over the wire. In a second tab, every entry should read
 * "remote".
 */
export function useNotesLog(notes: NotesMap | null, boardId: string): void {
  useEffect(() => {
    // Dev only: a drag writes a position every animation frame, which would be a
    // lot of noise in a production console.
    if (notes === null || !import.meta.env.DEV) return

    const handler = (
      events: Y.YEvent<Y.AbstractType<unknown>>[],
      transaction: Y.Transaction
    ) => {
      const source = transaction.local ? 'local' : 'remote'
      const label = `[yjs:${boardId}] ${source} change — ${notes.size} note(s)`

      const detail = events.map((event) => {
        // A change on the root map is an add/remove; anything deeper is a field
        // edit on one note, and `path` tells us which.
        const target = event.path.length === 0 ? 'notes' : `note ${event.path.join('.')}`

        if (event instanceof Y.YTextEvent) {
          return { target: `${target}.text`, delta: event.delta }
        }

        const changes: Record<string, string> = {}
        event.changes.keys.forEach((change, key) => {
          changes[key] = change.action
        })
        return { target, changes }
      })

      console.groupCollapsed(label)
      console.log('events:', detail)
      console.log('notes:', readAllNotes(notes))
      console.groupEnd()
    }

    notes.observeDeep(handler)
    return () => notes.unobserveDeep(handler)
  }, [notes, boardId])
}
