import { useEffect } from "react"
import { Effect } from "effect"
import {
  getPlayerPreferences,
  normalizePlayerPreferences,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
} from "~/lib/player-utils"
import { client } from "~/lib/effect/api/client"

export const AccountSettingsSynchronization = ({
  userId,
}: {
  userId?: string
}) => {
  useEffect(() => {
    if (!userId) {
      return
    }
    let didCancel = false
    Effect.runPromise(client.settings.getPlayerPreferences())
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
  }, [userId])

  return null
}
