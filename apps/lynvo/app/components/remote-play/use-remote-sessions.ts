import { useState } from "react"
import type { RemoteSession } from "./types"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"

declare global {
  interface RemoteSessionContract {
    id: string
    deviceName: string
    lastActiveAt: number
    receiverId?: string
    createdAt?: number
    isCurrent?: boolean
  }
}

export const loadRemoteSessions = async (
  listSessions: () => Promise<readonly RemoteSessionContract[]> = async () => {
    const url = new URL("/api/remote/receivers", window.location.href)
    const userId = document.querySelector<HTMLMetaElement>(
      'meta[name="lynvo-user-id"]'
    )?.content
    const sessionId = document.querySelector<HTMLMetaElement>(
      'meta[name="lynvo-session-id"]'
    )?.content
    if (userId && sessionId) {
      url.searchParams.set("expectedUserId", userId)
      url.searchParams.set("expectedSessionId", sessionId)
    }
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error("Remote receiver presence is unavailable")
    }
    const payload: unknown = await response.json()
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("receivers" in payload) ||
      !Array.isArray(payload.receivers)
    ) {
      throw new Error("Remote receiver presence is invalid")
    }
    return payload.receivers.filter(
      (receiver): receiver is RemoteSessionContract =>
        typeof receiver === "object" &&
        receiver !== null &&
        "id" in receiver &&
        "deviceName" in receiver &&
        "lastActiveAt" in receiver &&
        "receiverId" in receiver &&
        typeof receiver.id === "string" &&
        typeof receiver.deviceName === "string" &&
        typeof receiver.lastActiveAt === "number" &&
        typeof receiver.receiverId === "string"
    )
  }
): Promise<RemoteSession[]> => {
  const sessions = await listSessions()
  const currentReceiverId = getRemoteReceiverId()
  return sessions.flatMap((session) =>
    session.receiverId === currentReceiverId || session.isCurrent
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
