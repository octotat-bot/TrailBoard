import * as Y from 'yjs'

/**
 * Rewrites a Y.Text to match `next` using the smallest edit that explains the
 * change.
 *
 * A textarea only hands us the finished string, but a CRDT needs the *operation*
 * — replacing the whole text on every keystroke would delete and reinsert every
 * character, destroying a collaborator's concurrent edits and their cursor. So we
 * strip the common prefix and suffix and touch only the span in between, which
 * covers typing, backspacing, pasting, and replacing a selection.
 */
export function applyTextDiff(ytext: Y.Text, next: string): void {
  const prev = ytext.toString()
  if (prev === next) return

  let start = 0
  const maxStart = Math.min(prev.length, next.length)
  while (start < maxStart && prev[start] === next[start]) start += 1

  let prevEnd = prev.length
  let nextEnd = next.length
  while (prevEnd > start && nextEnd > start && prev[prevEnd - 1] === next[nextEnd - 1]) {
    prevEnd -= 1
    nextEnd -= 1
  }

  const removed = prevEnd - start
  const inserted = next.slice(start, nextEnd)

  const run = () => {
    if (removed > 0) ytext.delete(start, removed)
    if (inserted.length > 0) ytext.insert(start, inserted)
  }

  // One transaction so peers see a replacement, not a delete followed by a gap.
  if (ytext.doc === null) run()
  else ytext.doc.transact(run)
}

/**
 * Shifts a caret offset so it still points at the same character after a remote
 * edit lands.
 *
 * Without this, a collaborator typing above your cursor would make your own
 * caret drift backwards through the text while you type.
 */
export function mapCaret(caret: number, delta: Y.YTextEvent['delta']): number {
  let index = 0
  let moved = caret

  for (const op of delta) {
    if (typeof op.retain === 'number') {
      index += op.retain
    } else if (op.insert !== undefined) {
      const length = typeof op.insert === 'string' ? op.insert.length : 1
      // Text inserted at exactly the caret leaves the caret where it is, so the
      // user keeps typing before it rather than being pushed along.
      if (index < caret) moved += length
      index += length
    } else if (typeof op.delete === 'number') {
      if (index < caret) moved -= Math.min(op.delete, caret - index)
    }
  }

  return Math.max(0, moved)
}
