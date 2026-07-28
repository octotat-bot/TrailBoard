import type { NoteColor } from '../collab/notes'
import { MARKER_COLORS } from '../collab/identity'
import { noteRotation } from '../lib/rotation'
import { NOTE_PALETTE } from '../theme/palette'
// The pointer head reuses .cursor-arrow and .cursor-label from the board, so the
// demo cannot drift from how a real cursor is drawn. Imported explicitly rather
// than relying on the board route having already pulled this in.
import './board.css'

/**
 * A self-contained picture of the product for the landing page.
 *
 * Nothing here is connected: no Y.Doc, no WebSocket, no awareness. The notes and
 * cursors are fixed data animated in CSS, which keeps the home page from opening
 * a socket or creating a room just because someone looked at it.
 *
 * The pieces that decide how it *looks* are the real ones though — NOTE_PALETTE,
 * MARKER_COLORS, and noteRotation — so the demo cannot drift away from the board
 * it is advertising.
 */

interface DemoNote {
  id: string
  color: NoteColor
  text: string
  /** Percentages of the stage, so the whole scene reflows with its container. */
  left: number
  top: number
}

const DEMO_NOTES: DemoNote[] = [
  { id: 'demo-ship', color: 'butter', text: 'Ship the beta', left: 5, top: 15 },
  { id: 'demo-kickoff', color: 'sky', text: 'Kickoff Thu, 10am', left: 43, top: 5 },
  { id: 'demo-docs', color: 'sage', text: 'Who owns docs?', left: 19, top: 55 },
  { id: 'demo-yes', color: 'coral', text: 'Taking this one', left: 62, top: 45 }
]

const DEMO_CURSORS = [
  { name: 'Anonymous Otter', color: MARKER_COLORS[1], path: 'a' },
  { name: 'Anonymous Heron', color: MARKER_COLORS[0], path: 'b' }
] as const

/**
 * Dots ride the same keyframes as the pointer, just behind it.
 *
 * A negative delay of -(loop - lag) starts a dot that far into the cycle, which
 * on a loop reads as trailing the head by `lag`. So the trail comes free from the
 * animation the cursor is already running, with no per-frame work and no second
 * definition of the path to keep in sync.
 *
 * Lags are spaced for the ~60px/s the paths below travel at, which puts roughly
 * a dot-and-a-half of clear space between each one. Opacity runs 0.6 at the head
 * down to 0.1 at the tail, so the stroke reads as ink drying behind the pointer.
 */
const TRAIL_DOTS = [
  { lag: 300, opacity: 0.6 },
  { lag: 600, opacity: 0.43 },
  { lag: 900, opacity: 0.27 },
  { lag: 1200, opacity: 0.1 }
]

const LOOP_MS = { a: 11000, b: 9000 } as const

export function AmbientDemo() {
  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-stage">
        {DEMO_NOTES.map((note, index) => {
          const swatch = NOTE_PALETTE[note.color]
          return (
            <div
              key={note.id}
              className="demo-note"
              style={{
                left: `${note.left}%`,
                top: `${note.top}%`,
                background: swatch.fill,
                color: swatch.ink,
                // Same deterministic tilt the real notes use, so the demo sits at
                // believable angles rather than a designer's chosen ones.
                ['--tilt' as string]: `${noteRotation(note.id)}deg`,
                ['--settle-delay' as string]: `${140 * index}ms`
              }}
            >
              {note.text}
            </div>
          )
        })}

        {DEMO_CURSORS.map((cursor) => (
          <div key={cursor.name} className="demo-actor">
            {TRAIL_DOTS.map((dot, index) => (
              <span
                key={dot.lag}
                className={`demo-trail demo-path-${cursor.path}`}
                style={{
                  background: cursor.color,
                  opacity: dot.opacity,
                  animationDelay: `-${LOOP_MS[cursor.path] - dot.lag}ms`,
                  // Only read when motion is reduced and the path animation is
                  // off: the dots have no position of their own then, so this
                  // fans them out behind the resting pointer instead of letting
                  // all four stack on the same point.
                  ['--rest-step' as string]: index + 1
                }}
              />
            ))}

            <div className={`demo-cursor demo-path-${cursor.path}`}>
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
    </div>
  )
}
