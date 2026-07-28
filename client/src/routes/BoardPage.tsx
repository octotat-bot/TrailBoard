import { Navigate, useParams } from 'react-router-dom'

import { Board } from '../components/Board'
import { useBoardSession } from '../collab/useBoardSession'
import { useNotesLog } from '../collab/useNotesLog'
import { isValidBoardId } from '../lib/boardId'

export function BoardPage() {
  const { boardId } = useParams()

  if (!isValidBoardId(boardId)) {
    return <Navigate to="/" replace />
  }

  return <BoardSessionView boardId={boardId} />
}

function BoardSessionView({ boardId }: { boardId: string }) {
  const { session, status } = useBoardSession(boardId)

  useNotesLog(session?.notes ?? null, boardId)

  if (session === null) {
    return <div className="board-loading">opening board…</div>
  }

  return <Board session={session} status={status} />
}
