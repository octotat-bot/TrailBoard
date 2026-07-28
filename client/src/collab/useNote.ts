import { useMemo, useSyncExternalStore } from 'react'

import { readNote, type Note, type NotesMap } from './notes'

const EMPTY_IDS: string[] = []

/**
 * Ids of every note, ordered by creation time.
 *
 * This subscribes with `observe`, not `observeDeep`, on purpose: the root map
 * only changes shape when a note is added or removed, and we do not want the
 * whole board re-rendering every time somebody nudges a single note by a pixel.
 */
export function useNoteIds(notes: NotesMap | null): string[] {
  const store = useMemo(() => {
    const read = (): string[] => {
      if (notes === null) return EMPTY_IDS
      const entries: Array<{ id: string; createdAt: number }> = []
      notes.forEach((yNote, id) => {
        const createdAt = yNote.get('createdAt')
        entries.push({ id, createdAt: typeof createdAt === 'number' ? createdAt : 0 })
      })
      return entries.sort((a, b) => a.createdAt - b.createdAt).map((e) => e.id)
    }

    let snapshot = read()

    return {
      subscribe(onChange: () => void) {
        if (notes === null) return () => {}
        const handler = () => {
          snapshot = read()
          onChange()
        }
        notes.observe(handler)
        return () => notes.unobserve(handler)
      },
      getSnapshot: () => snapshot
    }
  }, [notes])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * One note's fields, subscribed at the note's own Y.Map.
 *
 * Pairing this with `useNoteIds` means a drag re-renders exactly one component.
 * `observeDeep` here rather than `observe` so body text edits, which live one
 * level down in the Y.Text, also trigger an update.
 */
export function useNote(notes: NotesMap | null, id: string): Note | null {
  const store = useMemo(() => {
    const read = (): Note | null => {
      const yNote = notes?.get(id)
      return yNote === undefined ? null : readNote(id, yNote)
    }

    let snapshot = read()

    return {
      subscribe(onChange: () => void) {
        const yNote = notes?.get(id)
        if (yNote === undefined) return () => {}
        const handler = () => {
          snapshot = read()
          onChange()
        }
        yNote.observeDeep(handler)
        return () => yNote.unobserveDeep(handler)
      },
      getSnapshot: () => snapshot
    }
  }, [notes, id])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
