import { useEffect } from "react"
import { useLocation } from "react-router"

import {
  getPlayerPreferences,
  normalizePlayerPreferences,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
} from "~/lib/player-utils"
import { loadCloudPlayerPreferences } from "~/lib/settings/player-preferences-api"

export const AccountSettingsSynchronization = ({
  userId,
  loadPlayerPreferences = loadCloudPlayerPreferences,
}: {
  userId?: string
  loadPlayerPreferences?: typeof loadCloudPlayerPreferences
}) => {
  const { pathname } = useLocation()
  const isPlayerSettingsRoute = pathname === "/settings/player"

  useEffect(() => {
    if (!userId || isPlayerSettingsRoute) {
      return undefined
    }
    let didCancel = false
    loadPlayerPreferences()
      .then((cloudPreferences) => {
        if (didCancel) {
          return
        }
        const localPreferences = getPlayerPreferences(userId)
        const preferences = normalizePlayerPreferences({
          rangeSupportedPlayerId:
            cloudPreferences.rangeSupportedPlayerId ??
            localPreferences.rangeSupportedPlayerId,
          rangeUnsupportedPlayerId:
            cloudPreferences.rangeUnsupportedPlayerId ??
            localPreferences.rangeUnsupportedPlayerId,
        })
        setRangeSupportedPlayer(userId, preferences.rangeSupportedPlayerId)
        setRangeUnsupportedPlayer(userId, preferences.rangeUnsupportedPlayerId)
      })
      .catch((error) => console.error(error))
    return () => {
      didCancel = true
    }
  }, [isPlayerSettingsRoute, loadPlayerPreferences, userId])

  return null
}
