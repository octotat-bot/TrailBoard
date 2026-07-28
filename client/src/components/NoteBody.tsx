import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

import { applyTextDiff, mapCaret } from '../lib/ytext'

interface NoteBodyProps {
  ytext: Y.Text
  onFinish: () => void
}

/**
 * A textarea bound directly to a Y.Text.
 *
 * The textarea is uncontrolled — its value is pushed imperatively rather than
 * rendered from React state. A controlled input would fight the CRDT: React
 * would re-render from a snapshot taken before a remote edit arrived and reset
 * the caret on every keystroke. Instead the Y.Text is the single source of truth,
 * local input is translated into insert/delete operations, and remote operations
 * are written into the DOM with the caret remapped around them.
 */
/**
 * Grows the field to fit its content.
 *
 * A textarea does not size to its text; left alone it keeps a fixed height and
 * scrolls internally, so a long note would look different while being edited
 * than it does at rest. Collapsing to `auto` first is what makes it shrink
 * again after a deletion — scrollHeight can never report less than the current
 * height.
 */
function autoSize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function NoteBody({ ytext, onFinish }: NoteBodyProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null) return

    el.value = ytext.toString()
    autoSize(el)
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)

    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      // Our own edits already landed in the DOM; rewriting would fight the caret.
      if (transaction.local) return

      const start = mapCaret(el.selectionStart, event.delta)
      const end = mapCaret(el.selectionEnd, event.delta)
      el.value = ytext.toString()
      el.setSelectionRange(start, end)
      // A peer's edit changes the line count too.
      autoSize(el)
    }

    ytext.observe(observer)
    return () => ytext.unobserve(observer)
  }, [ytext])

  return (
    <textarea
      ref={ref}
      className="note-input"
      data-no-drag
      // A textarea defaults to two rows, and `rows` is the floor that collapsing
      // to `height: auto` measures against. Left at the default, a one-line note
      // would measure two lines tall and the text would visibly shift the moment
      // you double-clicked it.
      rows={1}
      spellCheck={false}
      placeholder="Type something"
      onInput={(e) => {
        applyTextDiff(ytext, e.currentTarget.value)
        autoSize(e.currentTarget)
      }}
      onBlur={onFinish}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        // Let normal typing through without the board's shortcuts intercepting.
        e.stopPropagation()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
