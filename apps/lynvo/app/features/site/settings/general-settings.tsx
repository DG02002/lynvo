import { useTheme } from "next-themes"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "~/components/ui/select"
import { SelectTrigger } from "~/components/select-trigger"
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

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const

export function GeneralSettings() {
  const { theme = "system", setTheme } = useTheme()

  const handleAppearanceChange = (value: string | null) => {
    if (!value) {
      return
    }
    setTheme(value)
  }

  const selectedOption = appearanceOptions.find(
    (option) => option.value === theme
  )

  return (
    <SettingsPanel>
      <SettingsList>
        <SettingsRow>
          <SettingsRowInfo label="Appearance" />
          <Select value={theme} onValueChange={handleAppearanceChange}>
            <SelectTrigger className={settingsSelectTriggerClass}>
              <SelectValue>{selectedOption?.label || "System"}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className={settingsSelectContentClass}>
              <SelectGroup>
                {appearanceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
