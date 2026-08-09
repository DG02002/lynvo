import React, {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
} from "react"
import { realtimeReducer, type RealtimeStatus } from "./realtime/reducer"
import { openRealtimeSocket } from "./realtime/socket"

type RealtimeContextValue = {
  status: RealtimeStatus
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

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      dispatch({ type: "SET_STATUS", status: "disabled" })
      return
    }

    return openRealtimeSocket({ dispatch })
  }, [sessionId, userId])

  const value = useMemo(() => ({ status: state.status }), [state.status])

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
