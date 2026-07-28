import type { Awareness } from 'y-protocols/awareness'

import { MARKER_COLORS, type Identity, type MarkerColor } from './identity'

export interface CursorPoint {
  /** Board-canvas coordinates, not viewport coordinates. */
  x: number
  y: number
}

/**
 * The shape every peer publishes into awareness.
 *
 * Awareness is separate from the Y.Doc on purpose. It is ephemeral, last-write-
 * wins-per-client state with no history: it is never persisted to LevelDB, and it
 * is dropped automatically when a client disconnects or stops sending heartbeats.
 * Cursor positions belong here — putting them in the CRDT would grow the document
 * forever and write every mouse twitch to disk.
 */
export interface PresenceState {
  user: Identity
  cursor: CursorPoint | null
}

export interface PresenceUser extends Identity {
  clientId: number
  isLocal: boolean
}

export interface RemoteCursor extends CursorPoint {
  clientId: number
  name: string
  color: MarkerColor
}

const isMarkerColor = (v: unknown): v is MarkerColor =>
  typeof v === 'string' && (MARKER_COLORS as readonly string[]).includes(v)

/** Awareness payloads arrive from other machines, so nothing is trusted. */
export function parsePresence(raw: unknown): PresenceState | null {
  if (typeof raw !== 'object' || raw === null) return null

  const { user, cursor } = raw as { user?: unknown; cursor?: unknown }
  if (typeof user !== 'object' || user === null) return null

  const { name, color, initials } = user as Record<string, unknown>
  if (typeof name !== 'string' || !isMarkerColor(color)) return null

  let point: CursorPoint | null = null
  if (typeof cursor === 'object' && cursor !== null) {
    const { x, y } = cursor as Record<string, unknown>
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      point = { x, y }
    }
  }

  return {
    user: {
      name,
      color,
      initials: typeof initials === 'string' && initials.length > 0 ? initials.slice(0, 2) : '??'
    },
    cursor: point
  }
}

/** Everyone currently present, ordered stably so avatars do not shuffle. */
export function readPresenceUsers(awareness: Awareness): PresenceUser[] {
  const users: PresenceUser[] = []

  awareness.getStates().forEach((raw, clientId) => {
    const state = parsePresence(raw)
    if (state === null) return
    users.push({ ...state.user, clientId, isLocal: clientId === awareness.clientID })
  })

  return users.sort((a, b) => a.clientId - b.clientId)
}

/** Cursors of everyone except us, skipping peers whose pointer has left the board. */
export function readRemoteCursors(awareness: Awareness): RemoteCursor[] {
  const cursors: RemoteCursor[] = []

  awareness.getStates().forEach((raw, clientId) => {
    if (clientId === awareness.clientID) return
    const state = parsePresence(raw)
    if (state === null || state.cursor === null) return
    cursors.push({
      clientId,
      name: state.user.name,
      color: state.user.color,
      x: state.cursor.x,
      y: state.cursor.y
    })
  })

  return cursors.sort((a, b) => a.clientId - b.clientId)
}
