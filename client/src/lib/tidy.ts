import type * as Y from 'yjs'

import { getNotesMap, readAllNotes, type Note } from '../collab/notes'
import { NOTE_MIN_HEIGHT, NOTE_WIDTH } from '../theme/layout'

const GAP = 26
/** Keeps the grid clear of the chrome pinned to each corner of the board. */
const MARGIN = 88

export interface TidyViewport {
  width: number
  height: number
  scrollLeft: number
  scrollTop: number
  /**
   * Rendered height of each note, by id.
   *
   * Notes grow with their text, so heights vary and the layout cannot be
   * computed from the note data alone — only the DOM knows how tall a given
   * note ended up. Each row is then sized to its own tallest note: a single
   * uniform height would either overlap the row beneath or, if sized to the
   * tallest note on the board, strand every other row behind a large gap.
   */
  heights: ReadonlyMap<string, number>
}

/**
 * Lays every note out on a grid in the middle of the current view.
 *
 * The whole arrangement is one transaction, which matters twice over: peers see
 * the board rearrange in a single step rather than watching notes fly one at a
 * time, and it lands on the undo stack as a single entry, so tidying is one
 * keystroke away from being taken back.
 *
 * Ordering follows creation time, the same order the notes render in, so the
 * result is predictable rather than shuffled.
 */
export function tidyNotes(doc: Y.Doc, view: TidyViewport): void {
  const notes = getNotesMap(doc)
  const ordered = readAllNotes(notes)
  if (ordered.length === 0) return

  const cellWidth = NOTE_WIDTH + GAP
  const usable = Math.max(cellWidth, view.width - MARGIN * 2)
  const columns = Math.max(1, Math.min(ordered.length, Math.floor(usable / cellWidth)))

  const rows: Note[][] = []
  for (let i = 0; i < ordered.length; i += columns) rows.push(ordered.slice(i, i + columns))

  const rowHeights = rows.map((row) =>
    Math.max(NOTE_MIN_HEIGHT, ...row.map((n) => view.heights.get(n.id) ?? NOTE_MIN_HEIGHT))
  )

  const blockWidth = columns * cellWidth - GAP
  const blockHeight = rowHeights.reduce((sum, h) => sum + h + GAP, -GAP)

  // Centred on what the user is looking at, and never negative: note
  // coordinates are absolute, and a grid starting off the top-left of the
  // canvas would put notes somewhere they cannot be scrolled to.
  const originX = view.scrollLeft + Math.max(MARGIN / 2, (view.width - blockWidth) / 2)
  const originY = view.scrollTop + Math.max(MARGIN / 2, (view.height - blockHeight) / 2)

  doc.transact(() => {
    let y = originY
    rows.forEach((row, rowIndex) => {
      row.forEach((note, column) => {
        const yNote = notes.get(note.id)
        if (yNote === undefined) return
        yNote.set('x', Math.round(originX + column * cellWidth))
        yNote.set('y', Math.round(y))
      })
      y += (rowHeights[rowIndex] ?? NOTE_MIN_HEIGHT) + GAP
    })
  })
}
