import React, {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
  useRef,
} from "react"
import { realtimeReducer, type RealtimeStatus } from "./realtime/reducer"
import { openRealtimeSocket } from "./realtime/socket"

interface RealtimeContextValue {
  status: RealtimeStatus
  subscribeRemoteEvents: (
    listener: (event: RemoteRealtimeEvent) => void
  ) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(
  undefined
)

export function RealtimeProvider({
  children,
  user,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
}) {
  const userId = user?.id
  const sessionId = user?.sessionId
  const [state, dispatch] = useReducer(realtimeReducer, {
    status: userId ? "connecting" : "disabled",
  })
  const remoteEventListeners = useRef(
    new Set<(event: RemoteRealtimeEvent) => void>()
  )
  const receiveRemoteEvent = useCallback((event: RemoteRealtimeEvent) => {
    remoteEventListeners.current.forEach((listener) => listener(event))
  }, [])
  const subscribeRemoteEvents = useCallback(
    (listener: (event: RemoteRealtimeEvent) => void) => {
      remoteEventListeners.current.add(listener)
      return () => remoteEventListeners.current.delete(listener)
    },
    []
  )

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      dispatch({ type: "SET_STATUS", status: "disabled" })
      return
    }

    return openRealtimeSocket({ dispatch, receiveRemoteEvent })
  }, [receiveRemoteEvent, sessionId, userId])

  const value = useMemo(
    () => ({ status: state.status, subscribeRemoteEvents }),
    [state.status, subscribeRemoteEvents]
  )

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const context = use(RealtimeContext)
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider")
  }
  return context
}
