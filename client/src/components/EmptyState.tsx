/**
 * Shown when the board has no notes. The card is the affordance, not a
 * decoration — clicking it pins the first note where the card sits.
 */
export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" className="empty" onClick={onCreate}>
      Click to pin a note.
    </button>
  )
}
