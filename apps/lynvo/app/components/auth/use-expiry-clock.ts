import { useEffect, useState } from "react"

export const useExpiryClock = (expiresAt: number | undefined) => {
  const [hasExpired, setHasExpired] = useState(
    () => expiresAt !== undefined && Date.now() >= expiresAt
  )

  useEffect(() => {
    if (expiresAt === undefined) {
      setHasExpired(false)
      return
    }
    const remainingMs = expiresAt - Date.now()
    if (remainingMs <= 0) {
      setHasExpired(true)
      return
    }
    setHasExpired(false)
    const timeoutId = window.setTimeout(() => setHasExpired(true), remainingMs)
    return () => window.clearTimeout(timeoutId)
  }, [expiresAt])

  return hasExpired
}
