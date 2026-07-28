/**
 * A stable tilt for each note, between -3 and 3 degrees.
 *
 * Derived from the note id rather than randomised, because a random angle would
 * change on every render and jitter the whole board. Deriving it from the id also
 * means every collaborator sees the same note at the same angle without the angle
 * ever being stored in the document.
 *
 * FNV-1a: small, fast, and spreads similar ids (n_1a2b, n_1a2c) far apart, which
 * a naive character sum would not.
 */
export function noteRotation(id: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  // 601 buckets gives -3.00deg to 3.00deg in hundredth-of-a-degree steps.
  return (hash >>> 0) % 601 / 100 - 3
}
