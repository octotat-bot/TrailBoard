import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { addNote, randomNoteColor, topZ } from '../collab/notes'
import { useCanvasExtent } from '../collab/useCanvasExtent'
import { useCursorBroadcast } from '../collab/useCursorBroadcast'
import { useNoteIds } from '../collab/useNote'
import { useUndoManager } from '../collab/useUndoManager'
import type { BoardSession, ConnectionStatus } from '../collab/useBoardSession'
import { useCopyLink } from '../lib/useCopyLink'
import { NOTE_MIN_HEIGHT, NOTE_WIDTH } from '../theme/layout'
import { EmptyState } from './EmptyState'
import { PresenceBar } from './PresenceBar'
import { RemoteCursors } from './RemoteCursors'
import { StickyNote } from './StickyNote'
import './board.css'

interface BoardProps {
  session: BoardSession
  status: ConnectionStatus
}

/** Redo is the same arrow mirrored, so one path serves both. */
function UndoIcon({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={flipped ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M2.5 5.5h7a3.5 3.5 0 0 1 0 7H6" />
      <path d="M5 2.5 2 5.5l3 3" />
    </svg>
  )
}

export function Board({ session, status }: BoardProps) {
  const { doc, notes, boardId, awareness, identity } = session
  const ids = useNoteIds(notes)
  const extent = useCanvasExtent(notes)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cursor = useCursorBroadcast(awareness, canvasRef)
  const history = useUndoManager(notes)
  const link = useCopyLink()

  const handleCreate = () => {
    const viewport = viewportRef.current
    if (viewport === null) return

    // Place into the middle of whatever the user is currently looking at, then
    // cascade so repeated clicks do not stack notes exactly on top of each other.
    const step = (ids.length % 6) * 26
    const x = viewport.scrollLeft + viewport.clientWidth / 2 - NOTE_WIDTH / 2 + step
    const y = viewport.scrollTop + viewport.clientHeight / 2 - NOTE_MIN_HEIGHT / 2 + step

    addNote(doc, {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      color: randomNoteColor(),
      // A new note belongs on top of the pile, not underneath it.
      z: topZ(notes) + 1,
      author: { name: identity.name, initials: identity.initials, color: identity.color }
    })
  }

  return (
    <div
      className="board"
      ref={viewportRef}
      // Pointer moves during a note drag are retargeted to the captured note but
      // still bubble through here, so the cursor keeps broadcasting mid-drag.
      onPointerMove={(e) => cursor.report(e.clientX, e.clientY)}
      onPointerLeave={cursor.clear}
    >
      <div
        className="board-canvas"
        ref={canvasRef}
        style={{ width: extent.width, height: extent.height }}
      >
        {ids.length === 0 && <EmptyState onCreate={handleCreate} />}

        {ids.map((id) => (
          <StickyNote key={id} doc={doc} notes={notes} id={id} />
        ))}

        <RemoteCursors awareness={awareness} />
      </div>

      <div className="chrome chrome-left">
        {/* The way back out. A router Link rather than an anchor so leaving a
            board does not reload the app, and the wordmark rather than a "back"
            control because there is no history to go back to when someone
            arrives on a shared link. */}
        <Link to="/" className="chrome-home" title="Home">
          Trailboard
        </Link>
        <span className="chrome-divider" aria-hidden="true" />
        <span className={`status-dot status-${status}`} />
        <span className="status-label">
          {status === 'connected' ? `board / ${boardId}` : 'reconnecting'}
        </span>
      </div>

      <div className="chrome chrome-right">
        <PresenceBar awareness={awareness} />
      </div>

      <div className="chrome chrome-bottom">
        <div className="toolbar">
          <button
            type="button"
            className="tool"
            onClick={history.undo}
            disabled={!history.canUndo}
            title="Undo your last change"
            aria-label="Undo"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="tool"
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Redo"
            aria-label="Redo"
          >
            <UndoIcon flipped />
          </button>

          <span className="toolbar-divider" aria-hidden="true" />

          <button type="button" className="primary" onClick={handleCreate}>
            New note
          </button>

          <span className="toolbar-divider" aria-hidden="true" />

          <button
            type="button"
            className={`tool tool-wide${link.copied ? ' is-done' : ''}`}
            onClick={link.copy}
            title="Copy this board's link"
          >
            {link.copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}
