import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copies the current board URL, with a brief confirmation.
 *
 * The clipboard API rejects when the page is not a secure context or the user
 * denies permission, so there is a fallback that selects a throwaway textarea
 * and uses the old exec path. Between them this works on plain http://, which
 * matters because that is how the app is served in development.
 */
export function useCopyLink(): { copy: () => void; copied: boolean } {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const flash = useCallback(() => {
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }, [])

  const copy = useCallback(() => {
    const url = window.location.href

    void (async () => {
      try {
        await navigator.clipboard.writeText(url)
        flash()
        return
      } catch {
        /* fall through to the legacy path below */
      }

      const field = document.createElement('textarea')
      field.value = url
      field.setAttribute('readonly', '')
      // Kept out of view and out of the layout, but still selectable.
      field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
      document.body.appendChild(field)
      field.select()
      try {
        document.execCommand('copy')
        flash()
      } catch {
        /* nothing more to try — leave the button silent rather than lying */
      }
      document.body.removeChild(field)
    })()
  }, [flash])

  return { copy, copied }
}
