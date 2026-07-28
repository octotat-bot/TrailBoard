import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Read as a live subscription rather than a one-off check, so toggling the OS
 * setting takes effect without a reload.
 *
 * Motion is suppressed in JS as well as CSS here: the cursor trail is not a
 * decorative transition that a media query can switch off, it is elements we
 * would otherwise create sixty times a second, so the right fallback is to never
 * create them.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
