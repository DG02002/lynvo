import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { Result, Schema } from "effect"

const identityStatusSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ userId: Schema.String, sessionId: Schema.String }),
])

interface IdentitySynchronizerProps {
  user: { id: string; sessionId?: string } | null
  children: (validateIdentity: () => void) => ReactNode
}

export const IdentitySynchronizer = ({
  user,
  children,
}: IdentitySynchronizerProps) => {
  const isReloading = useRef(false)
  const validationGeneration = useRef(0)
  const validationRequest = useRef<Promise<void> | null>(null)
  const userId = user?.id
  const sessionId = user?.sessionId
  const validateIdentity = useCallback(() => {
    if (isReloading.current || validationRequest.current) {
      return
    }
    const generation = validationGeneration.current
    const identity = userId && sessionId ? { userId, sessionId } : undefined
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
        const payload = Schema.decodeUnknownResult(identityStatusSchema)(
          await response.json().catch(() => null)
        )
        const matches =
          response.ok &&
          Result.isSuccess(payload) &&
          ((!userId &&
            "status" in payload.success &&
            payload.success.status === "unauthenticated") ||
            ("userId" in payload.success &&
              payload.success.userId === userId &&
              payload.success.sessionId === sessionId))
        if (matches) {
          return
        }
        isReloading.current = true
        if (userId) {
          for (let index = localStorage.length - 1; index >= 0; index -= 1) {
            const key = localStorage.key(index)
            if (key?.includes(userId)) {
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
  }, [sessionId, userId])

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
