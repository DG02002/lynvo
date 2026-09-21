import { useCallback, useSyncExternalStore } from "react"

export const useExpiryClock = (expiresAt: number | undefined) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (expiresAt === undefined) {
        return () => undefined
      }
      const remainingMs = expiresAt - Date.now()
      if (remainingMs <= 0) {
        return () => undefined
      }
      const timeoutId = window.setTimeout(onChange, remainingMs)
      return () => window.clearTimeout(timeoutId)
    },
    [expiresAt]
  )

  const hasExpired = useSyncExternalStore(
    subscribe,
    () => expiresAt !== undefined && Date.now() >= expiresAt,
    () => false
  )

  return hasExpired
}
