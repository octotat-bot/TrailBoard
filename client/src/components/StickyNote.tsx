import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'

import {
  deleteNote,
  getNoteText,
  moveNote,
  NOTE_COLORS,
  setNoteColor,
  type NotesMap
} from '../collab/notes'
import { useNote } from '../collab/useNote'
import { noteRotation } from '../lib/rotation'
import { NOTE_PALETTE } from '../theme/palette'
import { NoteBody } from './NoteBody'

interface StickyNoteProps {
  doc: Y.Doc
  notes: NotesMap
  id: string
}

interface DragOrigin {
  pointerX: number
  pointerY: number
  noteX: number
  noteY: number
}

export function StickyNote({ doc, notes, id }: StickyNoteProps) {
  const note = useNote(notes, id)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState(false)

  const origin = useRef<DragOrigin | null>(null)
  const frame = useRef<number | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)

  /**
   * Pointer events fire far faster than the screen refreshes, and every write
   * here becomes a CRDT update and a WebSocket frame. Coalescing to one write per
   * animation frame keeps a drag at roughly 60 messages a second instead of
   * several hundred, with no visible difference.
   */
  const scheduleMove = useCallback(
    (x: number, y: number) => {
      pending.current = { x, y }
      if (frame.current !== null) return

      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const next = pending.current
        if (next !== null) moveNote(doc, id, next.x, next.y)
      })
    },
    [doc, id]
  )

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  if (note === null) return null

  const swatch = NOTE_PALETTE[note.color]
  const ytext = getNoteText(notes, id)
  const tilt = noteRotation(id)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing || e.button !== 0) return
    // Buttons and the textarea opt out so clicking them never starts a drag.
    if ((e.target as HTMLElement).closest('[data-no-drag]') !== null) return

    origin.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      noteX: note.x,
      noteY: note.y
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = origin.current
    if (from === null) return

    // Tracking the pointer *delta* rather than measuring against the canvas
    // means no getBoundingClientRect on the hot path, and a scroll or a window
    // resize mid-drag cannot make the note jump.
    scheduleMove(
      Math.max(0, Math.round(from.noteX + (e.clientX - from.pointerX))),
      Math.max(0, Math.round(from.noteY + (e.clientY - from.pointerY)))
    )
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    // Flush whatever the last frame did not get to, so the released position is
    // never a frame stale.
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    const last = pending.current
    if (last !== null) {
      moveNote(doc, id, last.x, last.y)
      pending.current = null
    }
  }

  return (
    <div
      className={`note${dragging ? ' is-dragging' : ''}${editing ? ' is-editing' : ''}`}
      style={{
        left: note.x,
        top: note.y,
        background: swatch.fill,
        color: swatch.ink,
        borderColor: dragging ? swatch.ink : 'transparent',
        // The tilt is baked into the same transform as the drag lift so the two
        // compose instead of overwriting one another.
        transform: `rotate(${tilt}deg) scale(${dragging ? 1.02 : 1})`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="note-actions" data-no-drag>
        <div className="note-swatches">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch${color === note.color ? ' is-active' : ''}`}
              style={{ background: NOTE_PALETTE[color].fill }}
              title={NOTE_PALETTE[color].label}
              aria-label={`Recolour note ${NOTE_PALETTE[color].label}`}
              onClick={() => setNoteColor(doc, id, color)}
            />
          ))}
        </div>
        <button
          type="button"
          className="note-delete"
          title="Delete note"
          aria-label="Delete note"
          style={{ color: swatch.ink }}
          onClick={() => deleteNote(doc, id)}
        >
          &times;
        </button>
      </div>

      {editing && ytext !== null ? (
        <NoteBody ytext={ytext} onFinish={() => setEditing(false)} />
      ) : (
        <p className="note-text">
          {note.text.length > 0 ? note.text : <span className="note-hint">Double-click to edit</span>}
        </p>
      )}
    </div>
  )
}
