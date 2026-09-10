import { useEffect } from "react"
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
  useEffect(() => {
    if (!userId) {
      return
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
  }, [loadPlayerPreferences, userId])

  return null
}
