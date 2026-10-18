import { ImmersiveBackButton } from "~/components/save-list/immersive-back-button"
import { Switch } from "~/components/ui/switch"

interface SaveListBackButtonProps {
  readonly onNavigateBack: () => void
}

interface FolderTitleDisplayToggleProps {
  readonly titleDisplay: FolderTitleDisplay
  readonly onToggle: () => void
}

export const SaveListBackButton = ({
  onNavigateBack,
}: SaveListBackButtonProps) => (
  <div className="contents md:block md:h-full md:border-r">
    <ImmersiveBackButton onNavigateBack={onNavigateBack} />
  </div>
)

export const FolderTitleDisplayToggleButton = ({
  titleDisplay,
  onToggle,
}: FolderTitleDisplayToggleProps) => {
  return (
    // A switch row is app chrome rather than a form label, so it renders as a
    // plain label with its touch-target treatment inline.
    <label
      htmlFor="episode-names-switch"
      className="flex h-9 cursor-pointer items-center gap-2 px-2.5 text-base font-medium text-foreground select-none"
      data-slot="episode-names-switch"
    >
      <Switch
        id="episode-names-switch"
        size="sm"
        checked={titleDisplay === "episode"}
        onCheckedChange={() => onToggle()}
      />
      Show episode names
    </label>
  )
}
