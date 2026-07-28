/**
 * Board ids travel in two places that constrain their alphabet: the browser URL
 * (/board/:boardId) and the WebSocket path the server parses into a room name.
 * The server rejects anything outside [A-Za-z0-9_-]{1,64}, so we stay well inside
 * that. Ambiguous glyphs (l/1, 0/o) are dropped so an id stays readable if
 * someone reads one out loud or copies it by hand.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const ID_LENGTH = 10

export const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function generateBoardId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  let id = ''
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length]
  }
  return id
}

export function isValidBoardId(id: string | undefined): id is string {
  return typeof id === 'string' && BOARD_ID_PATTERN.test(id)
}
