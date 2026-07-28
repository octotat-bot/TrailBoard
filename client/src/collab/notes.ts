import * as Y from 'yjs'

export const NOTE_COLORS = ['butter', 'sage', 'coral', 'sky', 'lilac'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

/**
 * Who wrote a note. Written once when the note is created and never touched
 * again, so unlike position or colour it needs no conflict granularity of its
 * own and can live as one plain value.
 */
export interface NoteAuthor {
  name: string
  initials: string
  color: string
}

/** A note as the React layer wants to consume it: a plain, readonly snapshot. */
export interface Note {
  id: string
  x: number
  y: number
  color: NoteColor
  text: string
  createdAt: number
  /** Stacking order. Absent on notes written before this existed, hence 0. */
  z: number
  author: NoteAuthor | null
}

/**
 * Each note is its own Y.Map rather than a plain object stored in the notes map.
 *
 * That choice sets the conflict granularity. With plain objects, writing a note
 * means replacing the whole value, so if you drag a note while I recolor the same
 * note, whichever update the CRDT orders last wins outright and the other edit is
 * discarded. With a nested Y.Map, `x`/`y` and `color` are independent keys, so
 * both survive — last-write-wins applies per field, not per note.
 *
 * The body text goes one level finer as a Y.Text, which merges per character. Two
 * people typing in the same note interleave their edits instead of clobbering
 * each other.
 *
 * Values are typed as `unknown` because a Y.Map is homogeneous in its type
 * parameter and ours holds numbers, strings, and a Y.Text. Reads go through
 * `readNote`, which validates and narrows in one place.
 */
export type YNote = Y.Map<unknown>
export type NotesMap = Y.Map<YNote>

/** The single well-known root key on the document. Both peers must agree on it. */
export const NOTES_KEY = 'notes'

export function getNotesMap(doc: Y.Doc): NotesMap {
  return doc.getMap<YNote>(NOTES_KEY)
}

export function createNoteId(): string {
  return `n_${crypto.randomUUID().slice(0, 8)}`
}

export function randomNoteColor(): NoteColor {
  const index = Math.floor(Math.random() * NOTE_COLORS.length)
  return NOTE_COLORS[index] ?? 'butter'
}

export interface NewNoteInput {
  x: number
  y: number
  color: NoteColor
  text?: string
  author?: NoteAuthor
  z?: number
}

/**
 * Builds the Y.Map for a note and inserts it under `notes`, all inside one
 * transaction so peers observe the finished note rather than a half-built one.
 */
export function addNote(doc: Y.Doc, input: NewNoteInput): string {
  const id = createNoteId()

  doc.transact(() => {
    const yNote: YNote = new Y.Map()
    yNote.set('x', input.x)
    yNote.set('y', input.y)
    yNote.set('color', input.color)
    yNote.set('createdAt', Date.now())
    yNote.set('z', input.z ?? 0)
    if (input.author !== undefined) yNote.set('author', input.author)
    // Attaching the Y.Text to the map is what integrates it into the document.
    yNote.set('text', new Y.Text(input.text ?? ''))
    getNotesMap(doc).set(id, yNote)
  })

  return id
}

export function deleteNote(doc: Y.Doc, id: string): void {
  getNotesMap(doc).delete(id)
}

/**
 * Position writes touch only `x` and `y`. A concurrent recolour of the same note
 * writes only `color`, so the two merge instead of one erasing the other.
 */
export function moveNote(doc: Y.Doc, id: string, x: number, y: number): void {
  const yNote = getNotesMap(doc).get(id)
  if (yNote === undefined) return
  doc.transact(() => {
    yNote.set('x', x)
    yNote.set('y', y)
  })
}

export function setNoteColor(doc: Y.Doc, id: string, color: NoteColor): void {
  getNotesMap(doc).get(id)?.set('color', color)
}

/** Highest `z` currently in use, so callers can stack a new note on top. */
export function topZ(notes: NotesMap): number {
  let max = 0
  notes.forEach((yNote) => {
    const z = yNote.get('z')
    if (typeof z === 'number' && z > max) max = z
  })
  return max
}

/**
 * Raises one note above the rest.
 *
 * `z` is its own key, so raising a note cannot disturb a concurrent move or
 * recolour of that same note. Two people raising different notes at the same
 * instant can land on the same `z`; the tie just resolves by render order and
 * the next click settles it, which is a far better failure than serialising
 * every click through a lock.
 *
 * Skipped when the note already outranks everything else, so a drag does not
 * write to the document before it has actually moved anything.
 */
export function bringToFront(doc: Y.Doc, id: string): void {
  const notes = getNotesMap(doc)
  const target = notes.get(id)
  if (target === undefined) return

  let highestOther = 0
  notes.forEach((yNote, otherId) => {
    if (otherId === id) return
    const z = yNote.get('z')
    if (typeof z === 'number' && z > highestOther) highestOther = z
  })

  const current = target.get('z')
  if (typeof current === 'number' && current > highestOther) return
  target.set('z', highestOther + 1)
}

/** The live Y.Text for a note's body, for binding directly to a textarea. */
export function getNoteText(notes: NotesMap, id: string): Y.Text | null {
  const text = notes.get(id)?.get('text')
  return text instanceof Y.Text ? text : null
}

const isNoteColor = (v: unknown): v is NoteColor =>
  typeof v === 'string' && (NOTE_COLORS as readonly string[]).includes(v)

/** Author travels as a plain value, so it gets the same distrust as the rest. */
function readAuthor(value: unknown): NoteAuthor | null {
  if (typeof value !== 'object' || value === null) return null
  const { name, initials, color } = value as Partial<NoteAuthor>
  if (typeof name !== 'string' || typeof initials !== 'string' || typeof color !== 'string') {
    return null
  }
  return { name, initials, color }
}

/**
 * Reads one note into a plain snapshot. Returns null for anything malformed —
 * a peer on an older build could have written a shape we no longer expect, and a
 * single bad entry should not take the whole board down.
 */
export function readNote(id: string, yNote: unknown): Note | null {
  if (!(yNote instanceof Y.Map)) return null

  const x = yNote.get('x')
  const y = yNote.get('y')
  const color = yNote.get('color')
  const text = yNote.get('text')
  const createdAt = yNote.get('createdAt')
  const z = yNote.get('z')

  if (typeof x !== 'number' || typeof y !== 'number') return null

  return {
    id,
    x,
    y,
    color: isNoteColor(color) ? color : 'butter',
    text: text instanceof Y.Text ? text.toString() : typeof text === 'string' ? text : '',
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
    z: typeof z === 'number' ? z : 0,
    author: readAuthor(yNote.get('author'))
  }
}

export function readAllNotes(notes: NotesMap): Note[] {
  const out: Note[] = []
  notes.forEach((yNote, id) => {
    const note = readNote(id, yNote)
    if (note !== null) out.push(note)
  })
  return out.sort((a, b) => a.createdAt - b.createdAt)
}
