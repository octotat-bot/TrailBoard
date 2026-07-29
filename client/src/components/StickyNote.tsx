import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'

import {
  bringToFront,
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
  /** Arrived since the board was opened, so it is worth animating in. */
  fresh: boolean
}

/** Must match the note-leave animation, or the note vanishes mid-fade. */
const EXIT_MS = 170

interface DragOrigin {
  pointerX: number
  pointerY: number
  noteX: number
  noteY: number
}

export function StickyNote({ doc, notes, id, fresh }: StickyNoteProps) {
  const note = useNote(notes, id)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)

  const origin = useRef<DragOrigin | null>(null)
  const frame = useRef<number | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)
  const exit = useRef<number | null>(null)

  /**
   * Deleting plays the note out before it leaves the document.
   *
   * The delay is local only. Removing the note from the Y.Map immediately would
   * unmount this component on the same frame, so there would be nothing left to
   * animate; instead the note is marked on its way out, and the CRDT delete —
   * the thing peers actually see — follows once the animation has run.
   */
  const handleDelete = useCallback(() => {
    if (removing) return
    setRemoving(true)
    exit.current = window.setTimeout(() => deleteNote(doc, id), EXIT_MS)
  }, [doc, id, removing])

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
      // A peer can delete the note while our own exit is still pending, which
      // unmounts us; the queued delete would then fire against a note that is
      // already gone.
      if (exit.current !== null) window.clearTimeout(exit.current)
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

    // Touching a note pulls it out from under whatever is covering it. Done
    // before the drag rather than after so the note is on top for the whole
    // gesture, and skipped internally when it already is, so a click on the
    // top note is not a document write.
    bringToFront(doc, id)

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
      className={
        `note${dragging ? ' is-dragging' : ''}${editing ? ' is-editing' : ''}` +
        `${fresh ? ' is-fresh' : ''}${removing ? ' is-removing' : ''}`
      }
      // Lets the tidy layout pair a rendered height back to the note it belongs
      // to; heights are only knowable from the DOM.
      data-note-id={id}
      style={
        {
          left: note.x,
          top: note.y,
          zIndex: note.z,
          background: swatch.fill,
          color: swatch.ink,
          borderColor: dragging ? swatch.ink : 'transparent',
          // Only the tilt is set here. The lift and scale are CSS variables the
          // stylesheet composes into one transform, because an inline transform
          // would outrank any :hover rule and make a hover lift impossible.
          //
          // Picking a note up straightens it, the way a hand does with a piece
          // of paper on a desk, and letting go lets it settle back to its own
          // angle. Set from here rather than CSS because the resting angle is
          // derived from the note's id and only JS knows it.
          '--tilt': dragging ? '0deg' : `${tilt}deg`,
          // Drives the arrival ring, so a note announces itself in the colour of
          // whoever wrote it.
          '--author-ink': note.author?.color ?? 'transparent'
        } as React.CSSProperties
      }
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
          onClick={handleDelete}
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

      {/* Reuses the author's presence colour, so the initials on a note match
          the cursor of whoever is writing it. Absent on notes made before
          authorship was recorded, which is why it is conditional. */}
      {note.author !== null && (
        <span
          className="note-author"
          style={{ background: note.author.color }}
          title={`Added by ${note.author.name}`}
        >
          {note.author.initials}
        </span>
      )}
    </div>
  )
}
