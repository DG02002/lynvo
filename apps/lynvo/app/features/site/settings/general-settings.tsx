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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
  setShouldHideTvBroSaveInput,
  useShouldHideTvBroSaveInput,
} from "./tvbro-save-input-preference"
import {
  setShouldAutoSaveAllLinks,
  useShouldAutoSaveAllLinks,
} from "./auto-save-links-preference"
import {
  setShouldUseLibraryMediaView,
  useShouldUseLibraryMediaView,
} from "./library-media-view-preference"

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const

export const GeneralSettings = () => {
  const { theme = "system", setTheme } = useTheme()
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()
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
            description="Save every extracted link without asking you to choose from the selection dialog."
          />
          <Switch
            checked={shouldAutoSaveAllLinks}
            onCheckedChange={setShouldAutoSaveAllLinks}
            aria-label="Save all links automatically"
          />
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
        <SettingsRow>
          <SettingsRowInfo
            label="Library UI mode"
            description="List shows every saved link in a folder-style browser. Library groups movies and shows with artwork from TMDB."
            note="Library mode is in beta."
          />
          <Tabs
            value={shouldUseLibraryMediaView ? "library" : "list"}
            onValueChange={(value) =>
              setShouldUseLibraryMediaView(value === "library")
            }
          >
            <TabsList aria-label="Library UI mode">
              <TabsTrigger value="list" className="px-4">
                List
              </TabsTrigger>
              <TabsTrigger value="library" className="px-4">
                Library
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
