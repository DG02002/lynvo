import { useTheme } from "next-themes"
import { useId } from "react"

import {
  Select,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import {
  setShouldAskBeforeMarkingAsWatched,
  useShouldAskBeforeMarkingAsWatched,
} from "~/lib/settings/opened-confirmation-preference"

import {
  setShouldAutoSaveAllLinks,
  useShouldAutoSaveAllLinks,
} from "./auto-save-links-preference"
import { setMediaView, useMediaView } from "./media-view-preference"
import { MediaViewSelector } from "./media-view-selector"
import {
  SettingsPanel,
  SettingsSelectContent,
  SettingsSelectTrigger,
  SettingsList,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"

const appearanceOptions = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const

export const GeneralSettings = () => {
  const { theme = "system", setTheme } = useTheme()
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()
  const shouldAskBeforeMarkingAsWatched = useShouldAskBeforeMarkingAsWatched()
  const mediaView = useMediaView()
  const appearanceLabelId = useId()
  const watchedConfirmationLabelId = useId()

  const handleAppearanceChange = (value: string | null) => {
    if (!value) {
      return
    }
    setTheme(value)
  }

  const selectedOption = appearanceOptions.find(
    (option) => option.value === theme
  )
  const appearanceValue = selectedOption?.label || "System"

  return (
    <SettingsPanel>
      <SettingsList>
        <SettingsRow>
          <SettingsRowInfo label="Appearance" labelId={appearanceLabelId} />
          <Select value={theme} onValueChange={handleAppearanceChange}>
            <SettingsSelectTrigger aria-labelledby={appearanceLabelId}>
              <SelectValue>{appearanceValue}</SelectValue>
            </SettingsSelectTrigger>
            <SettingsSelectContent align="end">
              <SelectGroup>
                {appearanceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SettingsSelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowInfo
            label="Save all links automatically"
            description="Save every playable link without a selection step."
          />
          <Switch
            checked={shouldAutoSaveAllLinks}
            onCheckedChange={setShouldAutoSaveAllLinks}
            aria-label="Save all links automatically"
          />
        </SettingsRow>
        <SettingsRow>
          <SettingsRowInfo
            label="Ask before marking items as watched"
            labelId={watchedConfirmationLabelId}
            description="After a link opens in a player, ask whether to mark it as watched."
          />
          <Switch
            checked={shouldAskBeforeMarkingAsWatched}
            onCheckedChange={setShouldAskBeforeMarkingAsWatched}
            aria-labelledby={watchedConfirmationLabelId}
          />
        </SettingsRow>
        <SettingsRow className="items-start flex-col gap-4">
          <SettingsRowInfo
            className="w-full pr-0"
            label="Saved links view"
            description="Choose how saved links appear in your library."
          />
          <MediaViewSelector value={mediaView} onValueChange={setMediaView} />
        </SettingsRow>
      </SettingsList>
    </SettingsPanel>
  )
}
