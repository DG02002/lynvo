import * as React from "react"
import { showErrorToast } from "~/lib/toast-notifications"
import {
  getPlayerPreferences,
  normalizePlayerPreferences,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
  type PlayerId,
} from "~/lib/player-utils"
import { createPlayerPreferenceWriteQueue } from "./player-preference-write-queue"

export interface CloudPlayerPreferences {
  rangeSupportedPlayerId?: PlayerId
  rangeUnsupportedPlayerId?: PlayerId
}

interface UseRangePlayerPreferencesInput {
  cloudPreferences: CloudPlayerPreferences | undefined
  playerPreferenceIdentity: string | undefined
  updateCloudPreferences: (preferences: CloudPlayerPreferences) => Promise<void>
}

export const useRangePlayerPreferences = ({
  cloudPreferences,
  playerPreferenceIdentity,
  updateCloudPreferences,
}: UseRangePlayerPreferencesInput) => {
  const [rangeSupportedPlayerId, setRangeSupportedPlayerId] =
    React.useState<PlayerId>(
      () =>
        getPlayerPreferences(playerPreferenceIdentity).rangeSupportedPlayerId
    )
  const [rangeUnsupportedPlayerId, setRangeUnsupportedPlayerId] =
    React.useState<PlayerId>(
      () =>
        getPlayerPreferences(playerPreferenceIdentity).rangeUnsupportedPlayerId
    )
  const initializedEmptyCloudPreferences = React.useRef(false)
  const rangeSupportedMutationGeneration = React.useRef(0)
  const rangeUnsupportedMutationGeneration = React.useRef(0)
  const rangeSupportedWriteQueue = React.useRef<ReturnType<
    typeof createPlayerPreferenceWriteQueue
  > | null>(null)
  const rangeUnsupportedWriteQueue = React.useRef<ReturnType<
    typeof createPlayerPreferenceWriteQueue
  > | null>(null)
  rangeSupportedWriteQueue.current ??= createPlayerPreferenceWriteQueue()
  rangeUnsupportedWriteQueue.current ??= createPlayerPreferenceWriteQueue()
  const supportedWriteQueue = rangeSupportedWriteQueue.current
  const unsupportedWriteQueue = rangeUnsupportedWriteQueue.current

  React.useEffect(() => {
    if (!cloudPreferences) {
      return
    }
    if (!playerPreferenceIdentity) {
      return
    }
    const localPreferences = getPlayerPreferences(playerPreferenceIdentity)

    if (
      cloudPreferences.rangeSupportedPlayerId ||
      cloudPreferences.rangeUnsupportedPlayerId
    ) {
      const preferences = normalizePlayerPreferences({
        rangeSupportedPlayerId:
          cloudPreferences.rangeSupportedPlayerId ??
          localPreferences.rangeSupportedPlayerId,
        rangeUnsupportedPlayerId:
          cloudPreferences.rangeUnsupportedPlayerId ??
          localPreferences.rangeUnsupportedPlayerId,
      })
      setRangeSupportedPlayerId(preferences.rangeSupportedPlayerId)
      setRangeUnsupportedPlayerId(preferences.rangeUnsupportedPlayerId)
      setRangeSupportedPlayer(
        playerPreferenceIdentity,
        preferences.rangeSupportedPlayerId
      )
      setRangeUnsupportedPlayer(
        playerPreferenceIdentity,
        preferences.rangeUnsupportedPlayerId
      )
      return
    }

    if (initializedEmptyCloudPreferences.current) {
      return
    }
    initializedEmptyCloudPreferences.current = true
    void updateCloudPreferences(localPreferences).catch(() => {
      showErrorToast({ title: "Player settings couldn’t be saved. Try again." })
    })
  }, [cloudPreferences, playerPreferenceIdentity, updateCloudPreferences])

  const handleRangeSupportedChange = (playerId: PlayerId) => {
    const mutationGeneration = rangeSupportedMutationGeneration.current + 1
    rangeSupportedMutationGeneration.current = mutationGeneration
    const previousPlayerId = rangeSupportedPlayerId
    setRangeSupportedPlayerId(playerId)
    if (!playerPreferenceIdentity) {
      return
    }
    setRangeSupportedPlayer(playerPreferenceIdentity, playerId)
    const write = supportedWriteQueue.enqueue(() =>
      updateCloudPreferences({ rangeSupportedPlayerId: playerId })
    )
    void write.catch(() => {
      if (rangeSupportedMutationGeneration.current !== mutationGeneration) {
        return
      }
      setRangeSupportedPlayerId(previousPlayerId)
      setRangeSupportedPlayer(playerPreferenceIdentity, previousPlayerId)
      showErrorToast({
        title: "The player setting couldn’t be saved. Try again.",
      })
    })
  }

  const handleRangeUnsupportedChange = (playerId: PlayerId) => {
    const mutationGeneration = rangeUnsupportedMutationGeneration.current + 1
    rangeUnsupportedMutationGeneration.current = mutationGeneration
    const previousPlayerId = rangeUnsupportedPlayerId
    setRangeUnsupportedPlayerId(playerId)
    if (!playerPreferenceIdentity) {
      return
    }
    setRangeUnsupportedPlayer(playerPreferenceIdentity, playerId)
    const write = unsupportedWriteQueue.enqueue(() =>
      updateCloudPreferences({ rangeUnsupportedPlayerId: playerId })
    )
    void write.catch(() => {
      if (rangeUnsupportedMutationGeneration.current !== mutationGeneration) {
        return
      }
      setRangeUnsupportedPlayerId(previousPlayerId)
      setRangeUnsupportedPlayer(playerPreferenceIdentity, previousPlayerId)
      showErrorToast({
        title: "The player setting couldn’t be saved. Try again.",
      })
    })
  }

  return {
    rangeSupportedPlayerId,
    rangeUnsupportedPlayerId,
    handleRangeSupportedChange,
    handleRangeUnsupportedChange,
  }
}
