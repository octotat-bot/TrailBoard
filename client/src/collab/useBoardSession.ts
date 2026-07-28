import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness'

import { createIdentity, type Identity } from './identity'
import { getNotesMap, type NotesMap } from './notes'
import type { PresenceState } from './presence'

/** Overridable so a deployed build can point at a non-local sync server. */
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface BoardSession {
  boardId: string
  doc: Y.Doc
  provider: WebsocketProvider
  notes: NotesMap
  awareness: Awareness
  identity: Identity
}

export interface UseBoardSessionResult {
  session: BoardSession | null
  status: ConnectionStatus
  /** True once the initial two-way handshake with the server has completed. */
  synced: boolean
}

/**
 * Owns one board's collaboration session: a Y.Doc, the WebSocket provider that
 * syncs it, and the root `notes` map.
 *
 * The whole session is built and torn down inside a single effect keyed on
 * boardId. That matters for two reasons:
 *
 *  - Navigating between boards must not reuse a document. A Y.Doc accumulates
 *    state permanently, so reusing one across boards would leak notes from the
 *    previous board into the next.
 *  - React StrictMode mounts, unmounts, and remounts every component in dev. A
 *    half-torn-down provider would leave a second live socket behind, and you'd
 *    see every change twice. Creating and destroying the entire session together
 *    makes the remount a genuine fresh start rather than a partial one.
 *
 * The session lands in state rather than a ref because consumers must re-render
 * once it exists. That costs one extra render on mount, during which callers see
 * `session === null` and render a loading state.
 */
export function useBoardSession(boardId: string): UseBoardSessionResult {
  const [session, setSession] = useState<BoardSession | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    const doc = new Y.Doc()
    const notes = getNotesMap(doc)

    // Constructed explicitly rather than letting the provider create one, so the
    // identity is published before the socket opens and the lifetime is ours.
    const awareness = new Awareness(doc)
    const identity = createIdentity()
    const initial: PresenceState = { user: identity, cursor: null }
    awareness.setLocalState(initial)

    // The provider appends the room name to the base URL, so this opens
    // ws://localhost:1234/<boardId> — which is exactly what the server parses
    // back out to pick the room. It also handles reconnect with backoff.
    const provider = new WebsocketProvider(WS_URL, boardId, doc, { awareness })

    const handleStatus = ({ status: next }: { status: ConnectionStatus }) => setStatus(next)
    const handleSync = (isSynced: boolean) => setSynced(isSynced)

    provider.on('status', handleStatus)
    provider.on('sync', handleSync)

    setSession({ boardId, doc, provider, notes, awareness, identity })

    return () => {
      provider.off('status', handleStatus)
      provider.off('sync', handleSync)
      // provider.destroy() closes the socket and broadcasts a null local state
      // so peers drop us immediately, but it only *unsubscribes* from an
      // awareness instance it did not create. Since we supplied this one, we
      // destroy it ourselves.
      provider.destroy()
      awareness.destroy()
      doc.destroy()
      setSession(null)
      setStatus('connecting')
      setSynced(false)
    }
  }, [boardId])

  return { session, status, synced }
}
