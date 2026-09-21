import { useEffect } from "react"

import { client } from "~/lib/api/client"
import { getBrowserDeviceName } from "~/lib/device-name"

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
