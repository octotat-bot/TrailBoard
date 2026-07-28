import type { Awareness } from 'y-protocols/awareness'

import { useCursorTrails } from '../collab/useCursorTrails'
import { useRemoteCursors } from '../collab/usePresence'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

/**
 * Other people's pointers, drawn inside the board canvas so their coordinates
 * line up with the notes regardless of anyone's window size or scroll position.
 */
export function RemoteCursors({ awareness }: { awareness: Awareness }) {
  const cursors = useRemoteCursors(awareness)
  const reducedMotion = usePrefersReducedMotion()
  const trails = useCursorTrails(cursors, !reducedMotion)

  return (
    <div className={`cursor-layer${reducedMotion ? ' is-still' : ''}`} aria-hidden="true">
      {cursors.map((cursor) => (
        <div key={cursor.clientId}>
          {(trails.get(cursor.clientId) ?? []).map((dot) => (
            <span
              key={dot.id}
              className="trail-dot"
              style={{
                background: cursor.color,
                transform: `translate3d(${dot.x}px, ${dot.y}px, 0)`
              }}
            />
          ))}

          <div
            className="cursor"
            style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }}
          >
            <svg className="cursor-arrow" viewBox="0 0 12 16" width="14" height="18">
              <path
                d="M1 1 L1 13.2 L4.3 10.1 L6.4 14.8 L8.6 13.8 L6.5 9.2 L11 9 Z"
                fill={cursor.color}
                stroke="#F6F7F5"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span className="cursor-label" style={{ background: cursor.color }}>
              {cursor.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
