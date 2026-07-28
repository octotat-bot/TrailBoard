/**
 * Per-session identity. Deliberately not persisted: the spec calls for a fresh
 * name and colour on every page load, which also makes two tabs on one machine
 * read as two distinct collaborators.
 */

const ANIMALS = [
  'Fox',
  'Otter',
  'Heron',
  'Marten',
  'Lynx',
  'Badger',
  'Falcon',
  'Ibex',
  'Magpie',
  'Tapir',
  'Puffin',
  'Wren',
  'Vole',
  'Osprey',
  'Beetle',
  'Moth'
] as const

/**
 * Marker colours are kept deliberately distinct from the note palette so a
 * cursor is never mistaken for a sticky note.
 */
export const MARKER_COLORS = [
  '#E85D9C',
  '#1FA6A0',
  '#B7862F',
  '#7F77DD',
  '#D85A30'
] as const

export type MarkerColor = (typeof MARKER_COLORS)[number]

export interface Identity {
  name: string
  color: MarkerColor
  /** Two letters for the presence avatar, e.g. "Anonymous Fox" -> "AF". */
  initials: string
}

function pick<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback
}

export function createIdentity(): Identity {
  const animal = pick(ANIMALS, 'Fox')
  return {
    name: `Anonymous ${animal}`,
    color: pick(MARKER_COLORS, '#E85D9C'),
    initials: `A${animal.charAt(0)}`
  }
}
