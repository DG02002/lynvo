import { Switch } from "~/components/ui/switch"
import {
  SettingsList,
  SettingsPanel,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"
import { useShouldHideTvBroSaveInput } from "./tvbro-save-input-preference"

export const MiscellaneousSettings = () => {
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()

  return (
    <SettingsPanel>
      <SettingsList>
        <SettingsRow>
          <SettingsRowInfo
            label="Hide the Add Link box in TV Bro"
            description="Keep saved links in focus on TV by hiding the Add Link box. This setting is always enabled."
          />
          <Switch
            checked={shouldHideTvBroSaveInput}
            disabled
            aria-label="Hide the Add Link box in TV Bro"
          />
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
