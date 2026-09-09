import { useEffect } from "react"
import { getBrowserDeviceName } from "~/lib/device-name"
import { client } from "~/lib/api/client"

export const AuthActivityTouch = ({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) => {
  useEffect(() => {
    if (isAuthenticated) {
      void client.settings.touchActivity({
        payload: { deviceName: getBrowserDeviceName() },
      })
    }
  }, [isAuthenticated])

  return null
}
