export const NOTE_WIDTH = 200
export const NOTE_MIN_HEIGHT = 150

/** Breathing room kept beyond the furthest note so there is always space to drag into. */
export const CANVAS_PADDING = 320

/**
 * The canvas only grows in steps this large. Resizing it on every dragged pixel
 * would re-render the whole board; quantising means the container changes size a
 * handful of times instead of hundreds.
 */
export const CANVAS_STEP = 480
