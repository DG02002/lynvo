import { File02Icon, Tv02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { DropdownMenuItem } from "~/components/ui/dropdown-menu"
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

const getFolderTitleDisplayMeta = (titleDisplay: FolderTitleDisplay) =>
  titleDisplay === "episode"
    ? { nextLabel: "Show filenames" }
    : { nextLabel: "Show episode names" }

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

export const FolderTitleDisplayToggleMenuItem = ({
  titleDisplay,
  onToggle,
}: FolderTitleDisplayToggleProps) => {
  const { nextLabel } = getFolderTitleDisplayMeta(titleDisplay)

  return (
    <DropdownMenuItem className="md:hidden" onClick={onToggle}>
      <HugeiconsIcon
        icon={titleDisplay === "episode" ? File02Icon : Tv02Icon}
      />
      {nextLabel}
    </DropdownMenuItem>
  )
}
