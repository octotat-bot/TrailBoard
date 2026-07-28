import { customAlphabet } from 'nanoid'

/**
 * Board ids travel in two places that constrain their alphabet: the browser URL
 * (/board/:boardId) and the WebSocket path the server parses into a room name.
 * The server rejects anything outside [A-Za-z0-9_-]{1,64}, so we stay well inside
 * that. Ambiguous glyphs (l/1, 0/o) are dropped so an id stays readable if
 * someone reads one out loud or copies it by hand.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const ID_LENGTH = 8

export const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * nanoid over our own alphabet rather than its default, which includes `-`, `_`,
 * and mixed case. Eight symbols from 32 is 40 bits, which is far more than enough
 * to keep boards from colliding while staying short enough to read aloud.
 */
export const generateBoardId = customAlphabet(ALPHABET, ID_LENGTH)

export function isValidBoardId(id: string | undefined): id is string {
  return typeof id === 'string' && BOARD_ID_PATTERN.test(id)
}

/**
 * Turns whatever someone pasted into a board id, or null if it isn't one.
 *
 * People share boards by copying the address bar, so a full URL has to work as
 * well as a bare code. Rather than trying `new URL` (which throws on a bare code)
 * this reduces both to path segments and looks for the one after "board" — that
 * way `https://host/board/abc?x=1`, `/board/abc/`, and `abc` all land on `abc`,
 * and a trailing slash can't leave us pointing at the literal segment "board".
 */
export function parseBoardCode(input: string): string | null {
  const withoutQuery = input.trim().split(/[?#]/)[0] ?? ''
  const segments = withoutQuery.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) return null

  const marker = segments.lastIndexOf('board')
  const candidate =
    marker !== -1 && marker < segments.length - 1
      ? segments[marker + 1]
      : segments[segments.length - 1]

  return isValidBoardId(candidate) ? candidate : null
}
