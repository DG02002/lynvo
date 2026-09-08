import { useSyncExternalStore } from "react"
import { Switch } from "~/components/ui/switch"
import { syncClientProfileAttribute } from "~/lib/client-profile"
import {
  getDevelopmentFreezeUsageEnabled,
  getDevelopmentTvBroUiEnabled,
  setDevelopmentFreezeUsageEnabled,
  setDevelopmentTvBroUiEnabled,
  subscribeToDevelopmentSettings,
} from "~/lib/development-settings"
import {
  SettingsList,
  SettingsPanel,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"

const handleTvBroUiChange = (enabled: boolean) => {
  setDevelopmentTvBroUiEnabled(enabled)
  syncClientProfileAttribute()
}

export const DevelopmentSettings = () => {
  const tvBroUiEnabled = useSyncExternalStore(
    subscribeToDevelopmentSettings,
    getDevelopmentTvBroUiEnabled,
    () => false
  )
  const freezeUsageEnabled = useSyncExternalStore(
    subscribeToDevelopmentSettings,
    getDevelopmentFreezeUsageEnabled,
    () => false
  )

  return (
    <SettingsPanel>
      <SettingsList>
        <SettingsRow>
          <SettingsRowInfo
            label="Use TV Bro-specific UI"
            description="Preview the TV Bro layout and defaults in this browser."
          />
          <Switch
            checked={tvBroUiEnabled}
            onCheckedChange={handleTvBroUiChange}
            aria-label="Use TV Bro-specific UI"
          />
        </SettingsRow>
        <SettingsRow>
          <SettingsRowInfo
            label="Freeze usage"
            description="Skip Lynvo's per-account daily and monthly counters for managed extractions from this browser. Global capacity and Plugin Server limits still apply."
          />
          <Switch
            checked={freezeUsageEnabled}
            onCheckedChange={setDevelopmentFreezeUsageEnabled}
            aria-label="Freeze usage"
          />
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
