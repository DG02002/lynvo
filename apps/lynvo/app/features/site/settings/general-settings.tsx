import { useTheme } from "next-themes"
import { Switch } from "~/components/ui/switch"
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
import {
  setShouldUseLibraryMediaView,
  useShouldUseLibraryMediaView,
} from "./library-media-view-preference"
import { LibraryMediaViewSelector } from "./library-media-view-selector"
import {
  setShouldAutoSaveAllLinks,
  useShouldAutoSaveAllLinks,
} from "./auto-save-links-preference"

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const

export const GeneralSettings = () => {
  const { theme = "system", setTheme } = useTheme()
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()
  const shouldUseLibraryMediaView = useShouldUseLibraryMediaView()

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
            label="Save all links automatically"
            description="Save every extracted link without a selection step."
          />
          <Switch
            checked={shouldAutoSaveAllLinks}
            onCheckedChange={setShouldAutoSaveAllLinks}
            aria-label="Save all links automatically"
          />
        </SettingsRow>
        <SettingsRow className="items-start flex-col gap-4">
          <SettingsRowInfo
            className="w-full pr-0"
            label="Library UI mode"
            description="Choose how saved links appear on the Save page."
          />
          <LibraryMediaViewSelector
            value={shouldUseLibraryMediaView ? "library" : "list"}
            onValueChange={(value) =>
              setShouldUseLibraryMediaView(value === "library")
            }
          />
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
