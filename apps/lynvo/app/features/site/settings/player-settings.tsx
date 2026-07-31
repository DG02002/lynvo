import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
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

export function PlayerSettings() {
  const cloudPreferences = useQuery(api.users.getPlayerPreferences, {})
  const updateCloudPreferences = useMutation(api.users.updatePlayerPreferences)
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
  }, [cloudPreferences, updateCloudPreferences])

  const handleRangeSupportedChange = (playerId: PlayerId) => {
    setRangeSupportedPlayerId(playerId)
    setRangeSupportedPlayer(playerId)
    void updateCloudPreferences({ rangeSupportedPlayerId: playerId }).catch(
      () => {
        toast.error("The player setting couldn’t be saved. Try again.")
      }
    )
    toast.success("Seeking player updated")
  }

  const handleRangeUnsupportedChange = (playerId: PlayerId) => {
    setRangeUnsupportedPlayerId(playerId)
    setRangeUnsupportedPlayer(playerId)
    void updateCloudPreferences({ rangeUnsupportedPlayerId: playerId }).catch(
      () => {
        toast.error("The player setting couldn’t be saved. Try again.")
      }
    )
    toast.success("Standard playback player updated")
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
            label="Player for videos with seeking"
            description="Used when a video can resume from a saved position or jump to another point."
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
            label="Player for standard playback"
            description="Used when a video must play from the beginning and cannot jump to another point."
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
