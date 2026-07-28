import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'

import type { NotesMap } from './notes'

export interface UndoControls {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const NOOP: UndoControls = {
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false
}

/**
 * Undo/redo scoped to your own edits.
 *
 * This is the one place a CRDT earns its keep visibly. A naive undo would
 * restore the document to an earlier snapshot, which on a shared board means
 * silently deleting whatever everyone else did in the meantime. Y.UndoManager
 * instead records which operations *you* produced and inverts only those, so
 * undo means "take back what I did" rather than "rewind the board".
 *
 * The mechanism is `trackedOrigins`, which defaults to `new Set([null])`. Local
 * transactions carry a null origin; updates arriving from the WebSocket carry
 * the provider as their origin, so remote work is never on your undo stack.
 * That default is exactly what we want, and it is load-bearing rather than
 * incidental — hence spelling it out here.
 */
export function useUndoManager(notes: NotesMap | null): UndoControls {
  const managerRef = useRef<Y.UndoManager | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    if (notes === null) return

    const manager = new Y.UndoManager(notes, {
      // A drag writes a position every animation frame. Without grouping, one
      // undo would rewind a single frame of movement and you would press it
      // fifty times to put a note back. 400ms collapses a gesture into one
      // entry while still separating two deliberate actions.
      captureTimeout: 400,
      // If someone else has since changed a key I am undoing, leave their value
      // alone. Undoing my own move should never yank a note out from under the
      // person who moved it after me.
      ignoreRemoteMapChanges: true
    })

    const sync = () => {
      setCanUndo(manager.canUndo())
      setCanRedo(manager.canRedo())
    }

    manager.on('stack-item-added', sync)
    manager.on('stack-item-popped', sync)
    manager.on('stack-cleared', sync)
    managerRef.current = manager
    sync()

    return () => {
      manager.destroy()
      managerRef.current = null
      setCanUndo(false)
      setCanRedo(false)
    }
  }, [notes])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const manager = managerRef.current
      if (manager === null) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return

      // While a note body has focus, leave undo to the browser. The textarea is
      // diffed into the Y.Text on input, so native undo still reaches the
      // document, and hijacking it here would rewind whole notes when someone
      // only meant to take back a word.
      const target = event.target as HTMLElement | null
      if (target !== null && target.closest('input, textarea, [contenteditable]') !== null) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) manager.redo()
      else manager.undo()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (notes === null) return NOOP

  return {
    undo: () => managerRef.current?.undo(),
    redo: () => managerRef.current?.redo(),
    canUndo,
    canRedo
  }
}
