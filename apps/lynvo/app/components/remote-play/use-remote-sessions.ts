import { useState } from "react"
import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"
import type { RemoteSession } from "./types"

declare global {
  interface RemoteSessionContract {
    id: string
    deviceName: string
    lastActiveAt: number
    createdAt: number
    isCurrent: boolean
  }
}

export const loadRemoteSessions = async (
  listSessions: () => Promise<readonly RemoteSessionContract[]> = () =>
    Effect.runPromise(client.settings.listSessions())
): Promise<RemoteSession[]> => {
  const sessions = await listSessions()
  return sessions.flatMap((session) =>
    session.isCurrent
      ? []
      : [
          {
            id: session.id,
            deviceName: session.deviceName,
            lastActiveAt: session.lastActiveAt,
          },
        ]
  )
}

export const useRemoteSessions = () => {
  const [sessions, setSessions] = useState<RemoteSession[]>([])
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const fetchSessions = async () => {
    setLoading(true)
    setHasError(false)
    try {
      setSessions(await loadRemoteSessions())
    } catch (error) {
      console.error("Unable to fetch remote sessions", error)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  return { sessions, loading, hasError, fetchSessions }
}
