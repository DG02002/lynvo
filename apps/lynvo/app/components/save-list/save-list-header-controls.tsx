import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { ImmersiveBackButton } from "~/components/save-list/immersive-back-button"

interface SaveListBackButtonProps {
  readonly onExit: () => void
}

interface FolderTitleDisplayToggleProps {
  readonly titleDisplay: FolderTitleDisplay
  readonly onToggle: () => void
}

export const SaveListBackButton = ({ onExit }: SaveListBackButtonProps) => (
  <div className="contents md:block md:h-full md:border-r">
    <ImmersiveBackButton onExit={onExit} />
  </div>
)

export const FolderTitleDisplayToggleButton = ({
  titleDisplay,
  onToggle,
}: FolderTitleDisplayToggleProps) => {
  return (
    <Label
      htmlFor="episode-names-switch"
      className="h-9 cursor-pointer gap-2 px-2.5 text-base text-foreground"
      data-slot="episode-names-switch"
    >
      <Switch
        id="episode-names-switch"
        size="sm"
        checked={titleDisplay === "episode"}
        onCheckedChange={() => onToggle()}
      />
      Episode names
    </Label>
  )
}
