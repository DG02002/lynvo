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
import { Switch } from "~/components/ui/switch"
import {
  setShouldHideTvBroSaveInput,
  useShouldHideTvBroSaveInput,
} from "./tvbro-save-input-preference"

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const

export const GeneralSettings = () => {
  const { theme = "system", setTheme } = useTheme()
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()

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
        <SettingsRow>
          <SettingsRowInfo
            label="Hide Add Link box in TV Bro"
            description="Keep your saved links in focus on TV. Turn this off if you also want to add links using your TV remote."
          />
          <Switch
            checked={shouldHideTvBroSaveInput}
            onCheckedChange={setShouldHideTvBroSaveInput}
            aria-label="Hide Add Link box in TV Bro"
          />
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
