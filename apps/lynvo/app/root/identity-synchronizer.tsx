import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { Result, Schema } from "effect"

const identityStatusSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ userId: Schema.String, sessionId: Schema.String }),
])

interface IdentitySynchronizerProps {
  user: { id: string; sessionId?: string } | null
  children: (validateIdentity: () => Promise<boolean>) => ReactNode
}

const SessionIdentityContext = createContext<() => Promise<boolean>>(
  async () => true
)

export const useEnsureSessionIdentity = () => use(SessionIdentityContext)

export const IdentitySynchronizer = ({
  user,
  children,
}: IdentitySynchronizerProps) => {
  const isReloading = useRef(false)
  const validationGeneration = useRef(0)
  const validationRequest = useRef<Promise<boolean> | null>(null)
  const validationRequired = useRef(false)
  const userId = user?.id
  const sessionId = user?.sessionId
  const validateIdentity = useCallback((): Promise<boolean> => {
    if (isReloading.current) {
      return Promise.resolve(false)
    }
    if (validationRequest.current) {
      return validationRequest.current
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
          return true
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
          return true
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
        return false
      })
      .catch(() => true)
      .finally(() => {
        if (validationRequest.current === request) {
          validationRequest.current = null
        }
      })
    validationRequest.current = request
    return request
  }, [sessionId, userId])

  const ensureFreshIdentity = useCallback(async () => {
    if (!validationRequired.current) {
      return true
    }
    const isValid = await validateIdentity()
    validationRequired.current = false
    return isValid
  }, [validateIdentity])

  useEffect(() => {
    validationGeneration.current += 1
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        validationRequired.current = true
        return
      }
      if (validationRequired.current) {
        void validateIdentity()
      }
    }
    const handleOnline = () => void validateIdentity()
    const handleFocus = () => void validateIdentity()
    window.addEventListener("online", handleOnline)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)
    void validateIdentity()
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [validateIdentity])

  return (
    <SessionIdentityContext.Provider value={ensureFreshIdentity}>
      {children(validateIdentity)}
    </SessionIdentityContext.Provider>
  )
}
