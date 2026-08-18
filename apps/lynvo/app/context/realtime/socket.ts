import type { RealtimeAction } from "./reducer"
import {
  isRealtimeHeartbeatResponse,
  parseRealtimeMessage,
} from "./message-schema"
import { REALTIME_SESSION_REVOKED_CLOSE_CODE } from "~/lib/constants"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"
import { getBrowserDeviceName } from "~/lib/device-name"
import { bindSessionIdentityToUrl } from "~/lib/session-identity"
import { z } from "zod"

const sessionHelloSchema = z.object({
  type: z.literal("session_hello"),
  userId: z.string(),
  sessionId: z.string(),
})

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

export const deliverRealtimeMessage = (
  value: string,
  receiveMessage: (message: RealtimeMessage) => void
) => {
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
  let attempt = 0

  const handleOpen = () => {
    attempt = 0
    dispatch({ type: "SET_STATUS", status: "connected" })
    onOpen()
    heartbeatTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "ping", payload: { at: Date.now() } })
        )
      }
    }, 25_000)
  }

  const handleMessage = (event: MessageEvent) => {
    try {
      const message = sessionHelloSchema.safeParse(
        JSON.parse(String(event.data))
      )
      if (message.success) {
        const expectedUserId = document.querySelector<HTMLMetaElement>(
          'meta[name="lynvo-user-id"]'
        )?.content
        const expectedSessionId = document.querySelector<HTMLMetaElement>(
          'meta[name="lynvo-session-id"]'
        )?.content
        if (
          message.data.userId !== expectedUserId ||
          message.data.sessionId !== expectedSessionId
        ) {
          closed = true
          socket?.close()
          onSessionRevoked()
        }
        return
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
    const delay = Math.min(30_000, 1_000 * 2 ** attempt)
    attempt += 1
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
