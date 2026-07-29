/**
 * Shown when the board has no notes. The card is the affordance, not a
 * decoration — clicking it pins the first note where the card sits.
 */
export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" className="empty" onClick={onCreate}>
      {/* Decorative, and contributes no text, so the card still reads as its
          one line of copy to a screen reader. */}
      <svg
        className="empty-mark"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>Click to pin a note.</span>
    </button>
  )
}
