import { useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import {
  getPlayerPreferences,
  normalizePlayerPreferences,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
} from "~/lib/player-utils"

export const AccountSettingsSynchronization = ({
  userId,
}: {
  userId?: string
}) => {
  const cloudPreferences = useQuery(
    api.users.getPlayerPreferences,
    userId ? {} : "skip"
  )

  useEffect(() => {
    if (!cloudPreferences || !userId) {
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
  }, [cloudPreferences, userId])

  return null
}
