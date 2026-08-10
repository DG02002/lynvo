import type { RealtimeAction } from "./reducer"
import { parseRealtimeMessage } from "./message-schema"

interface OpenRealtimeSocketOptions {
  dispatch: React.Dispatch<RealtimeAction>
  receiveMessage: (message: RealtimeMessage) => void
  onOpen: () => void
}

const closeSocket = (socket: WebSocket) => {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true })
    return
  }

  socket.close()
}

const websocketUrl = () => {
  const url = new URL("/api/realtime", window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

export const deliverRealtimeMessage = (
  value: string,
  receiveMessage: (message: RealtimeMessage) => void
) => {
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
    deliverRealtimeMessage(String(event.data), receiveMessage)
  }

  const removeSocketListeners = () => {
    if (!socket) {
      return
    }

    socket.removeEventListener("open", handleOpen)
    socket.removeEventListener("message", handleMessage)
    socket.removeEventListener("close", handleCloseOrError)
    socket.removeEventListener("error", handleCloseOrError)
  }

  const handleCloseOrError = () => {
    removeSocketListeners()
    window.clearInterval(heartbeatTimer)

    if (closed) {
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
    currentSocket.addEventListener("close", handleCloseOrError)
    currentSocket.addEventListener("error", handleCloseOrError)
  }

  connect()

  return () => {
    closed = true
    window.clearTimeout(reconnectTimer)
    window.clearInterval(heartbeatTimer)
    removeSocketListeners()
    if (socket) {
      closeSocket(socket)
    }
  }
}
