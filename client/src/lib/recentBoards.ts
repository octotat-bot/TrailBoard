import { isValidBoardId } from './boardId'

/**
 * The boards this browser has opened, newest first.
 *
 * Deliberately localStorage and nothing else. Board URLs are the only access
 * mechanism in this app, so there is no account to hang a board list off — this
 * is a convenience for the person sitting at this browser, not a record of
 * ownership or membership. Clearing site data is meant to lose it, and the list
 * never travels to the server.
 */

const STORAGE_KEY = 'trailboard.recent-boards'
const MAX_ENTRIES = 5

export interface RecentBoard {
  id: string
  visitedAt: number
}

/**
 * Storage throws rather than returning null in a few real situations (Safari
 * private browsing, cookies blocked, quota exceeded), and a landing page is the
 * last place that should white-screen. Every access goes through these two so a
 * failure degrades to "no recent boards" instead of an error boundary.
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeRaw(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage unavailable — the list is a convenience, so drop it silently */
  }
}

/** Anything hand-edited, truncated, or written by an older build is discarded. */
export function readRecentBoards(): RecentBoard[] {
  const raw = readRaw()
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const entries: RecentBoard[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const { id, visitedAt } = item as Partial<RecentBoard>
    if (!isValidBoardId(id) || typeof visitedAt !== 'number' || !Number.isFinite(visitedAt)) {
      continue
    }
    if (entries.some((entry) => entry.id === id)) continue
    entries.push({ id, visitedAt })
  }

  return entries.sort((a, b) => b.visitedAt - a.visitedAt).slice(0, MAX_ENTRIES)
}

/** Records a visit, moving an already-known board back to the top of the list. */
export function rememberBoard(id: string): RecentBoard[] {
  if (!isValidBoardId(id)) return readRecentBoards()

  const next = [
    { id, visitedAt: Date.now() },
    ...readRecentBoards().filter((entry) => entry.id !== id)
  ].slice(0, MAX_ENTRIES)

  writeRaw(JSON.stringify(next))
  return next
}

export function forgetBoard(id: string): RecentBoard[] {
  const next = readRecentBoards().filter((entry) => entry.id !== id)
  writeRaw(JSON.stringify(next))
  return next
}
