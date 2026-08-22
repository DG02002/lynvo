import { useState } from "react"
import type { RemoteSession } from "./types"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { Result, Schema } from "effect"

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

const remoteSessionContractSchema = Schema.Struct({
  id: Schema.String,
  deviceName: Schema.String,
  lastActiveAt: Schema.Number,
  receiverId: Schema.optional(Schema.String),
  createdAt: Schema.optional(Schema.Number),
  isCurrent: Schema.optional(Schema.Boolean),
})
const remoteSessionsResponseSchema = Schema.Struct({
  receivers: Schema.Array(remoteSessionContractSchema),
})

export const loadRemoteSessions = async (
  listSessions: () => Promise<readonly RemoteSessionContract[]> = async () => {
    const url = new URL("/api/remote/receivers", window.location.href)
    bindSessionIdentityToUrl(url)
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error("Remote receiver presence is unavailable")
    }
    const payload = Schema.decodeUnknownResult(remoteSessionsResponseSchema)(
      await response.json()
    )
    if (Result.isFailure(payload)) {
      throw new Error("Remote receiver presence is invalid")
    }
    return payload.success.receivers.filter(
      (receiver) => receiver.receiverId !== undefined
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
