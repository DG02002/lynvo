import { useState } from "react"
import type { RemoteSession } from "./types"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { z } from "zod"

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

const remoteSessionContractSchema = z.object({
  id: z.string(),
  deviceName: z.string(),
  lastActiveAt: z.number(),
  receiverId: z.string().optional(),
  createdAt: z.number().optional(),
  isCurrent: z.boolean().optional(),
})
const remoteSessionsResponseSchema = z.object({
  receivers: z.array(remoteSessionContractSchema),
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
    const payload = remoteSessionsResponseSchema.safeParse(
      await response.json()
    )
    if (!payload.success) {
      throw new Error("Remote receiver presence is invalid")
    }
    return payload.data.receivers.filter(
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
