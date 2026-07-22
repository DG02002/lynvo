import type { RealtimeAction } from "./reducer"

interface OpenRealtimeSocketOptions {
  dispatch: React.Dispatch<RealtimeAction>
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

const handleRealtimeMessage = (event: MessageEvent) => {
  try {
    const message = JSON.parse(String(event.data)) as {
      type: string
      payload?: Record<string, unknown>
    }

    if (message.type === "remote.event") {
      window.dispatchEvent(
        new CustomEvent("lynvo:remote-event", {
          detail: message.payload,
        })
      )
    }
  } catch (error) {
    console.error("Unable to read the real-time message", error)
  }
}

export const openRealtimeSocket = ({ dispatch }: OpenRealtimeSocketOptions) => {
  let socket: WebSocket | null = null
  let closed = false
  let reconnectTimer: number | undefined
  let heartbeatTimer: number | undefined
  let attempt = 0

  const handleOpen = () => {
    attempt = 0
    dispatch({ type: "SET_STATUS", status: "connected" })
    heartbeatTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "ping", payload: { at: Date.now() } })
        )
      }
    }, 25_000)
  }

  const handleMessage = (event: MessageEvent) => {
    handleRealtimeMessage(event)
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
