import { useCallback, useEffect, useRef, type ReactNode } from "react"
import type { QueryClient } from "@tanstack/react-query"

interface IdentitySynchronizerProps {
  user: { id: string; sessionId?: string } | null
  queryClient: QueryClient
  children: (validateIdentity: () => void) => ReactNode
}

export const IdentitySynchronizer = ({
  user,
  queryClient,
  children,
}: IdentitySynchronizerProps) => {
  const isReloading = useRef(false)
  const validateIdentity = useCallback(() => {
    if (isReloading.current) {
      return
    }
    void fetch("/api/auth/session/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status >= 500) {
          return
        }
        const payload: unknown = await response.json().catch(() => null)
        const matches =
          response.ok &&
          typeof payload === "object" &&
          payload !== null &&
          "userId" in payload &&
          "sessionId" in payload &&
          payload.userId === user?.id &&
          payload.sessionId === user?.sessionId
        if (matches || (!user && response.status === 401)) {
          return
        }
        isReloading.current = true
        queryClient.clear()
        if (user) {
          for (let index = localStorage.length - 1; index >= 0; index -= 1) {
            const key = localStorage.key(index)
            if (key?.includes(user.id)) {
              localStorage.removeItem(key)
            }
          }
        }
        window.location.reload()
      })
      .catch(() => undefined)
  }, [queryClient, user])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        validateIdentity()
      }
    }
    window.addEventListener("online", validateIdentity)
    window.addEventListener("focus", validateIdentity)
    document.addEventListener("visibilitychange", handleVisibility)
    validateIdentity()
    return () => {
      window.removeEventListener("online", validateIdentity)
      window.removeEventListener("focus", validateIdentity)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [validateIdentity])

  return children(validateIdentity)
}
