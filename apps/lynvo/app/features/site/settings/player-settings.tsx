import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { toast } from "sonner"
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
import { client } from "~/lib/effect/api/client"
import { playerPreferencesQueryKey } from "~/root/account-settings-synchronization"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"
import { createPlayerPreferenceWriteQueue } from "./player-preference-write-queue"

export function PlayerSettings() {
  const queryClient = useQueryClient()
  const playerPreferenceIdentity = usePlayerPreferenceIdentity()
  const queryKey = React.useMemo(
    () => playerPreferencesQueryKey(playerPreferenceIdentity),
    [playerPreferenceIdentity]
  )
  const { data: cloudPreferences } = useQuery({
    queryKey,
    queryFn: () => Effect.runPromise(client.settings.getPlayerPreferences()),
  })
  const updateCloudPreferences = React.useCallback(
    async (preferences: {
      rangeSupportedPlayerId?: PlayerId
      rangeUnsupportedPlayerId?: PlayerId
    }) => {
      await Effect.runPromise(
        client.settings.updatePlayerPreferences({ payload: preferences })
      )
      await queryClient.invalidateQueries({
        queryKey,
      })
    },
    [queryClient, queryKey]
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
  const rangeSupportedWriteQueue = React.useRef(
    createPlayerPreferenceWriteQueue()
  )
  const rangeUnsupportedWriteQueue = React.useRef(
    createPlayerPreferenceWriteQueue()
  )

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
      toast.error("Player settings couldn’t be saved. Try again.")
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
    const write = rangeSupportedWriteQueue.current.enqueue(() =>
      updateCloudPreferences({ rangeSupportedPlayerId: playerId })
    )
    void write
      .then(() => {
        if (rangeSupportedMutationGeneration.current === mutationGeneration) {
          toast.success("Player for links with HTTP byte-range support updated")
        }
      })
      .catch(() => {
        if (rangeSupportedMutationGeneration.current !== mutationGeneration) {
          return
        }
        setRangeSupportedPlayerId(previousPlayerId)
        setRangeSupportedPlayer(playerPreferenceIdentity, previousPlayerId)
        toast.error("The player setting couldn’t be saved. Try again.")
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
    const write = rangeUnsupportedWriteQueue.current.enqueue(() =>
      updateCloudPreferences({ rangeUnsupportedPlayerId: playerId })
    )
    void write
      .then(() => {
        if (rangeUnsupportedMutationGeneration.current === mutationGeneration) {
          toast.success(
            "Player for links without HTTP byte-range support updated"
          )
        }
      })
      .catch(() => {
        if (rangeUnsupportedMutationGeneration.current !== mutationGeneration) {
          return
        }
        setRangeUnsupportedPlayerId(previousPlayerId)
        setRangeUnsupportedPlayer(playerPreferenceIdentity, previousPlayerId)
        toast.error("The player setting couldn’t be saved. Try again.")
      })
  }

  const selectedRangeSupported = PLAYER_DEFINITIONS.find(
    (p) => p.id === rangeSupportedPlayerId
  )
  const selectedRangeUnsupported = PLAYER_DEFINITIONS.find(
    (p) => p.id === rangeUnsupportedPlayerId
  )

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
            onValueChange={(val) => handleRangeSupportedChange(val as PlayerId)}
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
            onValueChange={(val) =>
              handleRangeUnsupportedChange(val as PlayerId)
            }
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
