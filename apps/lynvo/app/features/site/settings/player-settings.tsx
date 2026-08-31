import * as React from "react"
import { Effect, Result, Schema } from "effect"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select"
import { SelectTrigger } from "~/components/select-trigger"
import {
  PLAYER_DEFINITIONS,
  playerIdSchema,
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
import { useRangePlayerPreferences } from "./use-range-player-preferences"
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
  const {
    rangeSupportedPlayerId,
    rangeUnsupportedPlayerId,
    handleRangeSupportedChange,
    handleRangeUnsupportedChange,
  } = useRangePlayerPreferences({
    cloudPreferences,
    playerPreferenceIdentity,
    updateCloudPreferences,
  })

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
