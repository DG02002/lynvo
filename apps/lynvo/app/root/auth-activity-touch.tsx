import { useEffect } from "react"
import { useMutation } from "convex/react"
import { useConvexAuth } from "@convex-dev/auth/react"
import { api } from "../../convex/_generated/api"
import { getBrowserDeviceName } from "~/lib/device-name"

export const AuthActivityTouch = () => {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const touchActivity = useMutation(api.users.touchActivity)
  const setCurrentSessionDevice = useMutation(api.users.setCurrentSessionDevice)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void Promise.all([
        touchActivity({}),
        setCurrentSessionDevice({ deviceName: getBrowserDeviceName() }),
      ])
    }
  }, [isLoading, isAuthenticated, setCurrentSessionDevice, touchActivity])

  return null
}
