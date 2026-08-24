import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { PLAYER_DEFINITIONS, type PlayerDefinition } from "~/lib/player-utils"
import { PlayerOption } from "~/components/player-option"
import { RemoveLinkAlertDialog } from "~/components/links/remove-link-alert-dialog"

interface LinkActionsRemoveRequest {
  readonly url: string
  readonly id?: string
  readonly onRemove: () => void
}

interface LinkActionsDotMenuProps {
  itemLabel: string
  onCopyLink: () => void
  onOpenInPlayer: (player: PlayerDefinition) => void
  isPlayable?: boolean
  className?: string
  removeRequest?: LinkActionsRemoveRequest
}

export function LinkActionsDotMenu({
  itemLabel,
  onCopyLink,
  onOpenInPlayer,
  isPlayable = true,
  className,
  removeRequest,
}: LinkActionsDotMenuProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const handleCopy = () => {
    onCopyLink()
    toast.success("Link copied")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className}
            onClick={(event) => event.stopPropagation()}
          >
            <HugeiconsIcon icon={EllipsisIcon} />
            <span className="sr-only">Open menu for {itemLabel}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopy}>
          <HugeiconsIcon icon={CopyIcon} />
          Copy link
        </DropdownMenuItem>
        {isPlayable && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={ArrowUpRight01Icon} />
              Open in
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {PLAYER_DEFINITIONS.map((player) => (
                <DropdownMenuItem
                  key={player.id}
                  onClick={() => onOpenInPlayer(player)}
                >
                  <PlayerOption player={player} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {removeRequest && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Remove saved link
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
      {removeRequest && (
        <RemoveLinkAlertDialog
          item={removeRequest}
          open={isRemoveDialogOpen}
          onOpenChange={setIsRemoveDialogOpen}
          onRemove={removeRequest.onRemove}
        />
      )}
    </DropdownMenu>
  )
}
