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
export function NoteBody({ ytext, onFinish }: NoteBodyProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null) return

    el.value = ytext.toString()
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)

    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      // Our own edits already landed in the DOM; rewriting would fight the caret.
      if (transaction.local) return

      const start = mapCaret(el.selectionStart, event.delta)
      const end = mapCaret(el.selectionEnd, event.delta)
      el.value = ytext.toString()
      el.setSelectionRange(start, end)
    }

    ytext.observe(observer)
    return () => ytext.unobserve(observer)
  }, [ytext])

  return (
    <textarea
      ref={ref}
      className="note-input"
      data-no-drag
      spellCheck={false}
      placeholder="Type something"
      onInput={(e) => applyTextDiff(ytext, e.currentTarget.value)}
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
