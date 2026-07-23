import { useState } from "react"
import type { RemoteSession } from "./types"
import { remoteSessionsResponseSchema } from "./schemas"

export const useRemoteSessions = () => {
  const [sessions, setSessions] = useState<RemoteSession[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/sessions")
      if (res.ok) {
        const result = remoteSessionsResponseSchema.safeParse(await res.json())
        setSessions(result.success ? result.data.sessions : [])
      }
    } catch (error) {
      console.error("Unable to fetch remote sessions", error)
    } finally {
      setLoading(false)
    }
  }

  return { sessions, loading, fetchSessions }
}
