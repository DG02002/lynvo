import { Result, Schema } from "effect"
import { useCallback, useState } from "react"

import { requestNoStoreSameOriginWithSessionIdentity } from "~/lib/api/client"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"
import { readIdentityMeta } from "~/lib/session-identity"

import type { RemoteSession } from "./types"

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
    const response = await requestNoStoreSameOriginWithSessionIdentity(
      "/api/remote/receivers"
    )
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

interface RemoteSessionState {
  readonly userId: string | undefined
  readonly sessions: RemoteSession[]
  readonly loading: boolean
  readonly hasError: boolean
}

// Keep this snapshot scoped to one account so reopening the dialog never
// flashes receivers from a different signed-in user.
let lastKnownSessions:
  | { readonly userId: string; readonly sessions: readonly RemoteSession[] }
  | undefined

const createRemoteSessionState = (
  userId: string | undefined
): RemoteSessionState => ({
  userId,
  sessions:
    userId && lastKnownSessions?.userId === userId
      ? [...lastKnownSessions.sessions]
      : [],
  loading: false,
  hasError: false,
})

export const useRemoteSessions = () => {
  const userId = readIdentityMeta("lynvo-user-id")
  const [state, setState] = useState(() => createRemoteSessionState(userId))
  const currentState =
    state.userId === userId ? state : createRemoteSessionState(userId)

  const fetchSessions = useCallback(async () => {
    setState((previousState) => ({
      ...(previousState.userId === userId
        ? previousState
        : createRemoteSessionState(userId)),
      loading: true,
      hasError: false,
    }))
    try {
      const nextSessions = await loadRemoteSessions()
      if (readIdentityMeta("lynvo-user-id") !== userId) {
        return
      }
      if (userId) {
        lastKnownSessions = { userId, sessions: nextSessions }
      }
      setState({
        userId,
        sessions: nextSessions,
        loading: false,
        hasError: false,
      })
    } catch (error) {
      console.error("Unable to fetch remote sessions", error)
      if (readIdentityMeta("lynvo-user-id") === userId) {
        setState((previousState) => ({
          ...(previousState.userId === userId
            ? previousState
            : createRemoteSessionState(userId)),
          loading: false,
          hasError: true,
        }))
      }
    } finally {
      setState((previousState) =>
        previousState.userId === userId
          ? { ...previousState, loading: false }
          : previousState
      )
    }
  }, [userId])

  return { ...currentState, fetchSessions }
}
