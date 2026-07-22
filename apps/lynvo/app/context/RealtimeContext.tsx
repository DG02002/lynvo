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
  const [state, dispatch] = useReducer(realtimeReducer, {
    status: user ? "connecting" : "disabled",
  })

  const [prevUser, setPrevUser] = React.useState(user)
  if (user !== prevUser) {
    setPrevUser(user)
    if (!user) {
      dispatch({ type: "SET_STATUS", status: "disabled" })
    }
  }

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return
    }

    return openRealtimeSocket({ dispatch })
  }, [user])

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
