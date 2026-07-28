import { useRef } from 'react'

import { addNote, randomNoteColor } from '../collab/notes'
import { useCanvasExtent } from '../collab/useCanvasExtent'
import { useCursorBroadcast } from '../collab/useCursorBroadcast'
import { useNoteIds } from '../collab/useNote'
import type { BoardSession, ConnectionStatus } from '../collab/useBoardSession'
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

export function Board({ session, status }: BoardProps) {
  const { doc, notes, boardId, awareness } = session
  const ids = useNoteIds(notes)
  const extent = useCanvasExtent(notes)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cursor = useCursorBroadcast(awareness, canvasRef)

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
      color: randomNoteColor()
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
        <span className={`status-dot status-${status}`} />
        <span className="status-label">
          {status === 'connected' ? `board / ${boardId}` : 'reconnecting'}
        </span>
      </div>

      <div className="chrome chrome-right">
        <PresenceBar awareness={awareness} />
      </div>

      <div className="chrome chrome-bottom">
        <button type="button" className="primary" onClick={handleCreate}>
          New note
        </button>
      </div>
    </div>
  )
}
