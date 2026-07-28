/**
 * Per-tab identity: a random name, marker colour, and initials.
 *
 * Held in sessionStorage, which is the only storage with the right lifetime.
 * localStorage would make every tab in the browser the same person, so two
 * windows side by side would show one duplicated avatar instead of two
 * collaborators. Nothing at all would re-roll the name on every refresh, which
 * makes you look like someone new to everyone else mid-session. sessionStorage
 * is scoped to the tab and survives reload, so you keep your face until you
 * close the tab, and a second tab is still a second person.
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

function createIdentity(): Identity {
  const animal = pick(ANIMALS, 'Fox')
  return {
    name: `Anonymous ${animal}`,
    color: pick(MARKER_COLORS, '#E85D9C'),
    initials: `A${animal.charAt(0)}`
  }
}

const STORAGE_KEY = 'trailboard.identity'

function isMarkerColor(value: unknown): value is MarkerColor {
  return MARKER_COLORS.includes(value as MarkerColor)
}

/**
 * A stored identity is only reused if it still matches the current shape. A
 * half-written entry or a colour from an older palette would otherwise pin
 * someone to a broken avatar for the life of the tab, with a reload no longer
 * able to shake it off.
 */
function parseIdentity(raw: string | null): Identity | null {
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const { name, color, initials } = parsed as Partial<Identity>
  if (typeof name !== 'string' || name.length === 0) return null
  if (typeof initials !== 'string' || initials.length === 0) return null
  if (!isMarkerColor(color)) return null

  return { name, color, initials }
}

/**
 * The identity for this tab, minted on first use and stable across reloads.
 *
 * Storage access is wrapped because it throws outright in some real
 * configurations (Safari private browsing, cookies blocked). Falling back to a
 * fresh identity per load is the old behaviour, which is a fine degradation.
 */
export function loadIdentity(): Identity {
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return createIdentity()
  }

  const existing = parseIdentity(stored)
  if (existing !== null) return existing

  const identity = createIdentity()
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    /* unavailable — the identity just won't survive this reload */
  }
  return identity
}
