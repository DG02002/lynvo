import { useState } from "react"
import type { RemoteSession } from "./types"
import { remoteSessionsResponseSchema } from "./schemas"

export const useRemoteSessions = () => {
  const [sessions, setSessions] = useState<RemoteSession[]>([])
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const fetchSessions = async () => {
    setLoading(true)
    setHasError(false)
    try {
      const res = await fetch("/api/sessions")
      if (res.ok) {
        const result = remoteSessionsResponseSchema.safeParse(await res.json())
        if (result.success) {
          setSessions(result.data.sessions)
        } else {
          setHasError(true)
        }
      } else {
        setHasError(true)
      }
    } catch (error) {
      console.error("Unable to fetch remote sessions", error)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  return { sessions, loading, hasError, fetchSessions }
}
