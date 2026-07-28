import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { generateBoardId } from '../lib/boardId'

/**
 * Visiting / mints a board id and redirects. Nothing is created server-side: a
 * board springs into existence the first time someone connects to that room, so
 * an unvisited id costs nothing.
 *
 * The id is generated in a state initialiser rather than during render so a
 * re-render (StrictMode double-invokes render in dev) can't mint a second id and
 * navigate somewhere else.
 */
export function NewBoardRedirect() {
  const [boardId] = useState(generateBoardId)
  return <Navigate to={`/board/${boardId}`} replace />
}
