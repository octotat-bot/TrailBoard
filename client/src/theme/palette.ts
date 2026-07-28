import type { NoteColor } from '../collab/notes'

export interface Swatch {
  /** Flat fill for the note body. */
  fill: string
  /** Darkened partner tone, used for text and for the border while dragging. */
  ink: string
  label: string
}

/**
 * The document stores a colour *name*, never a hex value. That keeps the palette
 * a presentation concern: restyling the board later does not require rewriting
 * every note already saved on disk.
 */
export const NOTE_PALETTE: Record<NoteColor, Swatch> = {
  butter: { fill: '#F5D877', ink: '#7A5B0A', label: 'Butter' },
  sage: { fill: '#A8C3A0', ink: '#2F4A2A', label: 'Sage' },
  coral: { fill: '#F0967D', ink: '#7A2E12', label: 'Coral' },
  sky: { fill: '#8FB8DE', ink: '#1B3A5C', label: 'Sky' },
  lilac: { fill: '#C9A8DE', ink: '#4A2E5C', label: 'Lilac' }
}
