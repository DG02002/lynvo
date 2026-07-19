import React, {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getClientSessionId } from "~/features/links/realtime-client"
import { realtimeReducer, type RealtimeStatus } from "./realtime/reducer"
import { openRealtimeSocket } from "./realtime/socket"

type RealtimeContextValue = {
  status: RealtimeStatus
  clientSessionId: string
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
  const queryClient = useQueryClient()
  const clientSessionId = useMemo(() => getClientSessionId(), [])
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

    return openRealtimeSocket({ user, clientSessionId, queryClient, dispatch })
  }, [clientSessionId, queryClient, user])

  const value = useMemo(
    () => ({ status: state.status, clientSessionId }),
    [clientSessionId, state.status]
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
