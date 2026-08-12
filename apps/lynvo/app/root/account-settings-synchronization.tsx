import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { useRealtime } from "~/context/RealtimeContext"
import { client } from "~/lib/effect/api/client"
import {
  getPlayerPreferences,
  normalizePlayerPreferences,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
} from "~/lib/player-utils"
import { ACCOUNT_SETTINGS_REFRESH_INTERVAL_MS } from "~/features/site/settings/constants"
import { playerPreferencesQueryKey } from "~/root/account-settings-query"

export const AccountSettingsSynchronization = ({
  userId,
}: {
  userId?: string
}) => {
  const realtime = useRealtime()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => playerPreferencesQueryKey(userId), [userId])
  const { data: cloudPreferences } = useQuery({
    queryKey,
    queryFn: () => Effect.runPromise(client.settings.getPlayerPreferences()),
    enabled: Boolean(userId),
  })

  useEffect(() => {
    if (!cloudPreferences) {
      return
    }
    if (!userId) {
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

  useEffect(() => {
    if (!userId) {
      return
    }
    const reconcile = () => {
      if (navigator.onLine && document.visibilityState === "visible") {
        void queryClient.invalidateQueries({
          queryKey,
        })
      }
    }
    const unsubscribe = realtime.subscribe((message) => {
      if (message.type === "account-settings.changed") {
        reconcile()
      }
    })
    const intervalId = window.setInterval(
      reconcile,
      ACCOUNT_SETTINGS_REFRESH_INTERVAL_MS
    )
    window.addEventListener("online", reconcile)
    document.addEventListener("visibilitychange", reconcile)
    return () => {
      unsubscribe()
      window.clearInterval(intervalId)
      window.removeEventListener("online", reconcile)
      document.removeEventListener("visibilitychange", reconcile)
    }
  }, [queryClient, queryKey, realtime, userId])

  useEffect(() => {
    if (
      userId &&
      realtime.connectionGeneration > 0 &&
      navigator.onLine &&
      document.visibilityState === "visible"
    ) {
      void queryClient.invalidateQueries({
        queryKey,
      })
    }
  }, [queryClient, queryKey, realtime.connectionGeneration, userId])

  return null
}
