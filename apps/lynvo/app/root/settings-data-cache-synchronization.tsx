import { useEffect, useRef } from "react"

import { useRealtime } from "~/context/realtime-context"
import { clearSettingsDataCacheForUser } from "~/features/site/settings/settings-data-cache"

export const SettingsDataCacheSynchronization = ({
  userId,
}: {
  userId?: string
}) => {
  const { subscribe } = useRealtime()
  const latestVersion = useRef<{ userId: string; version: number } | undefined>(
    undefined
  )

  useEffect(() => {
    if (!userId) {
      return undefined
    }
    return subscribe((message) => {
      let nextVersion: number | undefined
      if (message.type === "data-changed") {
        nextVersion = message.payload.version
      } else if (message.type === "session_hello") {
        nextVersion = message.dataVersion
      }
      if (nextVersion === undefined) {
        return
      }

      const previous = latestVersion.current
      const previousVersion =
        previous?.userId === userId ? previous.version : undefined
      if (previousVersion !== undefined && nextVersion > previousVersion) {
        clearSettingsDataCacheForUser(userId)
      }
      if (previousVersion === undefined || nextVersion > previousVersion) {
        latestVersion.current = { userId, version: nextVersion }
      }
    })
  }, [subscribe, userId])

  return null
}
