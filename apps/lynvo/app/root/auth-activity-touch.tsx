import { useEffect } from "react"
import { useMutation } from "convex/react"
import { useConvexAuth } from "@convex-dev/auth/react"
import { api } from "../../convex/_generated/api"

export const AuthActivityTouch = () => {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const touchActivity = useMutation(api.users.touchActivity)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void touchActivity({})
    }
  }, [isLoading, isAuthenticated, touchActivity])

  return null
}
