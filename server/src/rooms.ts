import { docs } from 'y-websocket/bin/utils'

/** Anything that could collide with LevelDB keys or path traversal is rejected. */
const VALID_BOARD_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * A room is just a Yjs document name, and the document name comes from the
 * WebSocket URL path: `ws://host:1234/board123` -> room "board123".
 *
 * y-websocket derives this itself by default, but doing it here lets us reject
 * junk before a document is created (an unvalidated name would otherwise create
 * a stray room on disk for every bad request).
 */
export function parseBoardId(url: string | undefined): string | null {
  if (!url) return null

  const pathname = url.split('?')[0]
  const raw = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '')

  if (!VALID_BOARD_ID.test(raw)) return null
  return raw
}

export interface RoomSummary {
  boardId: string
  connections: number
  awarenessClients: number
}

/** Snapshot of live rooms, used by the /health endpoint. */
export function listRooms(): RoomSummary[] {
  return Array.from(docs.entries()).map(([boardId, doc]) => ({
    boardId,
    connections: doc.conns.size,
    awarenessClients: doc.awareness.getStates().size
  }))
}
