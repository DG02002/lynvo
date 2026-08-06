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

const PLAYER_PREFERENCES_QUERY_KEY = ["settings", "player"]

export function PlayerSettings() {
  const queryClient = useQueryClient()
  const { data: cloudPreferences } = useQuery({
    queryKey: PLAYER_PREFERENCES_QUERY_KEY,
    queryFn: () => Effect.runPromise(client.settings.getPlayerPreferences()),
  })
  const updateCloudPreferences = async (preferences: {
    rangeSupportedPlayerId?: PlayerId
    rangeUnsupportedPlayerId?: PlayerId
  }) => {
    await Effect.runPromise(
      client.settings.updatePlayerPreferences({ payload: preferences })
    )
    await queryClient.invalidateQueries({
      queryKey: PLAYER_PREFERENCES_QUERY_KEY,
    })
  }
  const [rangeSupportedPlayerId, setRangeSupportedPlayerId] =
    React.useState<PlayerId>(
      () => getPlayerPreferences().rangeSupportedPlayerId
    )
  const [rangeUnsupportedPlayerId, setRangeUnsupportedPlayerId] =
    React.useState<PlayerId>(
      () => getPlayerPreferences().rangeUnsupportedPlayerId
    )
  const initializedCloudPreferences = React.useRef(false)

  React.useEffect(() => {
    if (!cloudPreferences || initializedCloudPreferences.current) {
      return
    }

    initializedCloudPreferences.current = true
    const localPreferences = getPlayerPreferences()

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
      setRangeSupportedPlayer(preferences.rangeSupportedPlayerId)
      setRangeUnsupportedPlayer(preferences.rangeUnsupportedPlayerId)
      return
    }

    void updateCloudPreferences(localPreferences).catch(() => {
      toast.error("Player settings couldn’t be saved. Try again.")
    })
  }, [cloudPreferences])

  const handleRangeSupportedChange = (playerId: PlayerId) => {
    setRangeSupportedPlayerId(playerId)
    setRangeSupportedPlayer(playerId)
    void updateCloudPreferences({ rangeSupportedPlayerId: playerId }).catch(
      () => {
        toast.error("The player setting couldn’t be saved. Try again.")
      }
    )
    toast.success("Player for links with HTTP byte-range support updated")
  }

  const handleRangeUnsupportedChange = (playerId: PlayerId) => {
    setRangeUnsupportedPlayerId(playerId)
    setRangeUnsupportedPlayer(playerId)
    void updateCloudPreferences({ rangeUnsupportedPlayerId: playerId }).catch(
      () => {
        toast.error("The player setting couldn’t be saved. Try again.")
      }
    )
    toast.success("Player for links without HTTP byte-range support updated")
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
            label="Player for links with HTTP byte-range support"
            description="Default for links whose server supports HTTP byte-range requests, which can enable seeking."
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
            label="Player for links without HTTP byte-range support"
            description="Default for links whose server does not support HTTP byte-range requests. VLC may still allow seeking for some links."
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
