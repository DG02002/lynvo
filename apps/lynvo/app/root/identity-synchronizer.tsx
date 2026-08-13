import { useCallback, useEffect, useRef, type ReactNode } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { z } from "zod"

const identityStatusSchema = z.union([
  z.object({ status: z.literal("unauthenticated") }),
  z.object({ userId: z.string(), sessionId: z.string() }),
])

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
  const validationGeneration = useRef(0)
  const validationRequest = useRef<Promise<void> | null>(null)
  const validateIdentity = useCallback(() => {
    if (isReloading.current || validationRequest.current) {
      return
    }
    const generation = validationGeneration.current
    const identity =
      user?.id && user.sessionId
        ? { userId: user.id, sessionId: user.sessionId }
        : undefined
    const url = bindSessionIdentityToUrl(
      new URL("/api/auth/session/status", window.location.href),
      identity
    )
    const request = fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (
          response.status >= 500 ||
          generation !== validationGeneration.current
        ) {
          return
        }
        const payload = identityStatusSchema.safeParse(
          await response.json().catch(() => null)
        )
        const matches =
          response.ok &&
          payload.success &&
          ((!user &&
            "status" in payload.data &&
            payload.data.status === "unauthenticated") ||
            ("userId" in payload.data &&
              payload.data.userId === user?.id &&
              payload.data.sessionId === user?.sessionId))
        if (matches) {
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
      .finally(() => {
        if (validationRequest.current === request) {
          validationRequest.current = null
        }
      })
    validationRequest.current = request
  }, [queryClient, user])

  useEffect(() => {
    validationGeneration.current += 1
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
