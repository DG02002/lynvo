import * as React from "react"
import { Effect, Result, Schema } from "effect"
import { showErrorToast } from "~/lib/toast-notifications"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select"
import { SelectTrigger } from "~/components/select-trigger"
import {
  PLAYER_DEFINITIONS,
  getPlayerPreferences,
  normalizePlayerPreferences,
  playerIdSchema,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
  type PlayerId,
} from "~/lib/player-utils"
import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"
import {
  settingsSelectContentClass,
  settingsSelectTriggerClass,
} from "./settings-layout-classes"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"
import { createPlayerPreferenceWriteQueue } from "./player-preference-write-queue"
import { useAsyncResource } from "~/hooks/use-async-resource"
import { client } from "~/lib/effect/api/client"

const loadCloudPlayerPreferences = () =>
  Effect.runPromise(client.settings.getPlayerPreferences())

const saveCloudPlayerPreferences = (preferences: {
  rangeSupportedPlayerId?: PlayerId
  rangeUnsupportedPlayerId?: PlayerId
}) =>
  Effect.runPromise(
    client.settings.updatePlayerPreferences({ payload: preferences })
  ).then(() => undefined)

export const PlayerSettings = ({
  loadPlayerPreferences = loadCloudPlayerPreferences,
  savePlayerPreferences = saveCloudPlayerPreferences,
}: {
  loadPlayerPreferences?: typeof loadCloudPlayerPreferences
  savePlayerPreferences?: typeof saveCloudPlayerPreferences
} = {}) => {
  const playerPreferenceIdentity = usePlayerPreferenceIdentity()
  const { data: cloudPreferencesData } = useAsyncResource(
    () =>
      playerPreferenceIdentity
        ? loadPlayerPreferences()
        : Promise.resolve(undefined),
    [loadPlayerPreferences, playerPreferenceIdentity]
  )
  const cloudPreferences = cloudPreferencesData
  const updateCloudPreferences = React.useCallback(
    async (preferences: {
      rangeSupportedPlayerId?: PlayerId
      rangeUnsupportedPlayerId?: PlayerId
    }) => {
      await savePlayerPreferences(preferences)
    },
    [savePlayerPreferences]
  )
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

  const selectedRangeSupported = PLAYER_DEFINITIONS.find(
    (p) => p.id === rangeSupportedPlayerId
  )
  const selectedRangeUnsupported = PLAYER_DEFINITIONS.find(
    (p) => p.id === rangeUnsupportedPlayerId
  )
  const updateRangeSupportedPlayer = (value: string | null) => {
    const playerId = Schema.decodeUnknownResult(playerIdSchema)(value)
    if (Result.isSuccess(playerId)) {
      handleRangeSupportedChange(playerId.success)
    }
  }
  const updateRangeUnsupportedPlayer = (value: string | null) => {
    const playerId = Schema.decodeUnknownResult(playerIdSchema)(value)
    if (Result.isSuccess(playerId)) {
      handleRangeUnsupportedChange(playerId.success)
    }
  }

  return (
    <SettingsPanel>
      <SettingsList>
        <SettingsRow>
          <SettingsRowInfo
            label="Links with HTTP byte-range support"
            description="Use for links that let the player jump forward or backward."
          />
          <Select
            value={rangeSupportedPlayerId}
            onValueChange={updateRangeSupportedPlayer}
          >
            <SelectTrigger className={settingsSelectTriggerClass}>
              <SelectValue>
                {selectedRangeSupported && (
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedRangeSupported.iconUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover shrink-0"
                    />
                    <span>{selectedRangeSupported.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className={settingsSelectContentClass}>
              {PLAYER_DEFINITIONS.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  <div className="flex items-center gap-2">
                    <img
                      src={player.iconUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover shrink-0"
                    />
                    <span>{player.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow>
          <SettingsRowInfo
            label="Links without HTTP byte-range support"
            description="Use for links that may not let the player jump forward or backward."
          />
          <Select
            value={rangeUnsupportedPlayerId}
            onValueChange={updateRangeUnsupportedPlayer}
          >
            <SelectTrigger className={settingsSelectTriggerClass}>
              <SelectValue>
                {selectedRangeUnsupported && (
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedRangeUnsupported.iconUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover shrink-0"
                    />
                    <span>{selectedRangeUnsupported.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className={settingsSelectContentClass}>
              {PLAYER_DEFINITIONS.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  <div className="flex items-center gap-2">
                    <img
                      src={player.iconUrl}
                      alt=""
                      className="size-5 rounded-sm object-cover shrink-0"
                    />
                    <span>{player.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
