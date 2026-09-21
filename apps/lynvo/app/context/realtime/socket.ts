import { Result, Schema } from "effect"

import {
  REALTIME_HEARTBEAT_INTERVAL_MS,
  REALTIME_HEARTBEAT_TIMEOUT_MS,
  REALTIME_SESSION_REVOKED_CLOSE_CODE,
} from "~/lib/constants"
import { getBrowserDeviceName } from "~/lib/device-name"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"

import {
  isRealtimeHeartbeatResponse,
  parseRealtimeMessage,
  sessionHelloRealtimeMessageSchema,
} from "./message-schema"
import type { RealtimeAction } from "./reducer"

export const REALTIME_RECONNECT_FAILURE_STORAGE_KEY =
  "lynvo:realtime:failed-connection-attempts"

const REALTIME_RECONNECT_FAILURE_WINDOW_MS = 60 * 1_000

const reconnectFailureHistorySchema = Schema.Array(
  Schema.Number.pipe(Schema.check(Schema.isFinite()))
)

interface OpenRealtimeSocketOptions {
  dispatch: React.Dispatch<RealtimeAction>
  receiveMessage: (message: RealtimeMessage) => void
  onOpen: () => void
  onSessionRevoked: () => void
}

const closeSocket = (socket: WebSocket) => {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true })
    return
  }

  socket.close()
}

const websocketUrl = () => {
  const url = bindSessionIdentityToUrl(
    new URL("/api/realtime", window.location.href)
  )
  const receiverId = getRemoteReceiverId()
  if (receiverId) {
    url.searchParams.set("receiverId", receiverId)
    url.searchParams.set("deviceName", getBrowserDeviceName())
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

const readRecentReconnectFailures = (now: number): number[] => {
  try {
    const stored = window.sessionStorage.getItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY
    )
    if (!stored) {
      return []
    }
    const parsed = Schema.decodeUnknownResult(reconnectFailureHistorySchema)(
      JSON.parse(stored)
    )
    if (Result.isFailure(parsed)) {
      return []
    }
    return parsed.success.filter(
      (timestamp): timestamp is number =>
        timestamp > now - REALTIME_RECONNECT_FAILURE_WINDOW_MS &&
        timestamp <= now
    )
  } catch {
    // Invalid or unavailable session storage should not stop reconnecting.
    return []
  }
}

const recordReconnectFailure = (now: number): number => {
  const failures = [...readRecentReconnectFailures(now), now]
  try {
    window.sessionStorage.setItem(
      REALTIME_RECONNECT_FAILURE_STORAGE_KEY,
      JSON.stringify(failures)
    )
  } catch {
    // Private browsing can reject writes; the in-memory attempt still backs off.
  }
  return failures.length
}

const clearReconnectFailures = (): void => {
  try {
    window.sessionStorage.removeItem(REALTIME_RECONNECT_FAILURE_STORAGE_KEY)
  } catch {
    // Clearing persisted failures is best effort after a successful connection.
  }
}

export const deliverRealtimeMessage = (
  value: string,
  receiveMessage: (message: RealtimeMessage) => void
): boolean => {
  if (isRealtimeHeartbeatResponse(value)) {
    return true
  }

  const message = parseRealtimeMessage(value)

  if (!message) {
    console.error("Unable to read the real-time message")
    return false
  }

  receiveMessage(message)
  return true
}

export const openRealtimeSocket = ({
  dispatch,
  receiveMessage,
  onOpen,
  onSessionRevoked,
}: OpenRealtimeSocketOptions) => {
  let socket: WebSocket | null = null
  let closed = false
  let reconnectTimer: number | undefined
  let heartbeatTimer: number | undefined
  let attempt = readRecentReconnectFailures(Date.now()).length
  let lastServerContactAt = Date.now()

  const handleOpen = () => {
    attempt = 0
    clearReconnectFailures()
    lastServerContactAt = Date.now()
    dispatch({ type: "SET_STATUS", status: "connected" })
    onOpen()
    heartbeatTimer = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
      }
      // A half-open connection keeps the "connected" status while delivering
      // nothing; missing pongs for two intervals proves the socket is dead
      // and closes it so the normal reconnect path takes over.
      if (Date.now() - lastServerContactAt > REALTIME_HEARTBEAT_TIMEOUT_MS) {
        socket.close()
        return
      }
      socket.send("ping")
    }, REALTIME_HEARTBEAT_INTERVAL_MS)
  }

  const handleMessage = (event: MessageEvent) => {
    lastServerContactAt = Date.now()
    try {
      const message = Schema.decodeUnknownResult(
        sessionHelloRealtimeMessageSchema
      )(JSON.parse(String(event.data)))
      if (Result.isSuccess(message)) {
        const expectedUserId = document.querySelector<HTMLMetaElement>(
          'meta[name="lynvo-user-id"]'
        )?.content
        const expectedSessionId = document.querySelector<HTMLMetaElement>(
          'meta[name="lynvo-session-id"]'
        )?.content
        if (
          message.success.userId !== expectedUserId ||
          message.success.sessionId !== expectedSessionId
        ) {
          closed = true
          socket?.close()
          onSessionRevoked()
          return
        }
      }
    } catch {}
    deliverRealtimeMessage(String(event.data), receiveMessage)
  }

  const removeSocketListeners = () => {
    if (!socket) {
      return
    }

    socket.removeEventListener("open", handleOpen)
    socket.removeEventListener("message", handleMessage)
    socket.removeEventListener("close", handleClose)
    socket.removeEventListener("error", handleError)
  }

  const handleError = () => {
    dispatch({ type: "SET_STATUS", status: "disconnected" })
  }

  const handleClose = (event: CloseEvent) => {
    removeSocketListeners()
    window.clearInterval(heartbeatTimer)

    if (closed) {
      return
    }

    if (event.code === REALTIME_SESSION_REVOKED_CLOSE_CODE) {
      closed = true
      onSessionRevoked()
      return
    }

    dispatch({ type: "SET_STATUS", status: "disconnected" })
    const failedAttempts = recordReconnectFailure(Date.now())
    const baseDelay = Math.min(30_000, 1_000 * 2 ** attempt)
    // Jitter prevents every client from reconnecting in lockstep after a deploy.
    const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5))
    attempt = Math.max(attempt + 1, failedAttempts)
    reconnectTimer = window.setTimeout(connect, delay)
  }

  const connect = () => {
    if (closed) {
      return
    }

    dispatch({ type: "SET_STATUS", status: "connecting" })
    const currentSocket = new WebSocket(websocketUrl())
    socket = currentSocket

    currentSocket.addEventListener("open", handleOpen)
    currentSocket.addEventListener("message", handleMessage)
    currentSocket.addEventListener("close", handleClose)
    currentSocket.addEventListener("error", handleError)
  }

  connect()

  return {
    close: () => {
      closed = true
      window.clearTimeout(reconnectTimer)
      window.clearInterval(heartbeatTimer)
      removeSocketListeners()
      if (socket) {
        closeSocket(socket)
      }
    },
  }
}
