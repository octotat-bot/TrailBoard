import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AmbientDemo } from '../components/AmbientDemo'
import { generateBoardId, parseBoardCode } from '../lib/boardId'
import { forgetBoard, readRecentBoards } from '../lib/recentBoards'
import '../components/home.css'

/** Coarse on purpose: this is a "which one was I just on" cue, not a log. */
function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function HomePage() {
  const navigate = useNavigate()
  // Read once on mount rather than subscribing: this component only exists while
  // nobody is on a board, and it remounts on every return from one.
  const [recent, setRecent] = useState(readRecentBoards)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * Boards are not created here, or anywhere else. Minting an id and navigating
   * is the whole operation — the room springs into existence server-side on first
   * connection, so an id nobody visits costs nothing.
   */
  const startBoard = () => {
    navigate(`/board/${generateBoardId()}`)
  }

  const joinBoard = (event: FormEvent) => {
    event.preventDefault()
    const boardId = parseBoardCode(code)

    if (boardId === null) {
      setError('That is not a board code or link.')
      return
    }
    navigate(`/board/${boardId}`)
  }

  return (
    <main className="home">
      <div className="home-inner">
        <section className="home-copy">
          <p className="wordmark">Trailboard</p>

          <h1 className="home-title">A shared wall for sticky notes.</h1>
          <p className="home-sub">
            Start a board, send the link, and write on it together. Everyone sees every
            change as it happens. There is no account to make.
          </p>

          <button type="button" className="home-start" onClick={startBoard}>
            Start a board
          </button>

          <form className="home-join" onSubmit={joinBoard}>
            <label className="home-join-label" htmlFor="board-code">
              have a board code?
            </label>
            <div className="home-join-row">
              <input
                id="board-code"
                className="home-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="code or pasted link"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  if (error !== null) setError(null)
                }}
              />
              <button type="submit" className="primary">
                Join
              </button>
            </div>
            {error !== null && (
              <p className="home-error" role="alert">
                {error}
              </p>
            )}
          </form>

          {recent.length > 0 && (
            <section className="recent">
              <h2 className="recent-title">Recent boards</h2>
              <ul className="recent-list">
                {recent.map((board) => (
                  <li key={board.id} className="recent-item">
                    <button
                      type="button"
                      className="recent-open"
                      onClick={() => navigate(`/board/${board.id}`)}
                    >
                      <span className="recent-id">board / {board.id}</span>
                      <span className="recent-time">{relativeTime(board.visitedAt)}</span>
                    </button>
                    <button
                      type="button"
                      className="recent-forget"
                      title={`Forget ${board.id}`}
                      aria-label={`Forget board ${board.id}`}
                      onClick={() => setRecent(forgetBoard(board.id))}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              <p className="recent-note">Saved in this browser only.</p>
            </section>
          )}
        </section>

        <section className="home-demo">
          <AmbientDemo />
        </section>
      </div>
    </main>
  )
}
