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

export interface RealtimeContextValue {
  status: RealtimeStatus
  connectionGeneration: number
  subscribe: (listener: (message: RealtimeMessage) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(
  undefined
)

export function RealtimeProvider({
  children,
  user,
  onSessionRevoked,
  onConnectionOpen,
}: {
  children: React.ReactNode
  user: { id: string; sessionId?: string } | null
  onSessionRevoked?: (userId: string) => void
  onConnectionOpen?: () => void
}) {
  const userId = user?.id
  const sessionId = user?.sessionId
  const [state, dispatch] = useReducer(realtimeReducer, {
    status: userId ? "connecting" : "disabled",
  })
  const [connectionGeneration, incrementConnectionGeneration] = useReducer(
    (generation: number) => generation + 1,
    0
  )
  const listeners = useRef(new Set<(message: RealtimeMessage) => void>())
  const receiveMessage = useCallback((message: RealtimeMessage) => {
    listeners.current.forEach((listener) => listener(message))
  }, [])
  const subscribe = useCallback(
    (listener: (message: RealtimeMessage) => void) => {
      listeners.current.add(listener)
      return () => listeners.current.delete(listener)
    },
    []
  )

  useEffect(() => {
    if (!userId || globalThis.window === undefined) {
      dispatch({ type: "SET_STATUS", status: "disabled" })
      return
    }

    const realtimeSocket = openRealtimeSocket({
      dispatch,
      receiveMessage,
      onOpen: () => {
        incrementConnectionGeneration()
        onConnectionOpen?.()
      },
      onSessionRevoked: () => {
        onSessionRevoked?.(userId)
      },
    })
    return () => {
      realtimeSocket.close()
    }
  }, [onConnectionOpen, onSessionRevoked, receiveMessage, sessionId, userId])

  const value = useMemo(
    () => ({
      status: state.status,
      connectionGeneration,
      subscribe,
    }),
    [connectionGeneration, state.status, subscribe]
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

export const useOptionalRealtime = () => use(RealtimeContext)
