import { useEffect } from "react"
import { Effect } from "effect"
import { getBrowserDeviceName } from "~/lib/device-name"
import { client } from "~/lib/effect/api/client"

export const AuthActivityTouch = ({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) => {
  useEffect(() => {
    if (isAuthenticated) {
      void Effect.runPromise(
        client.settings.touchActivity({
          payload: { deviceName: getBrowserDeviceName() },
        })
      )
    }
  }, [isAuthenticated])

  return null
}
