import {
  ArrowUpRight01Icon,
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { RemoveLinkAlertDialog } from "~/components/links/remove-link-alert-dialog"
import { MenuTriggerButton } from "~/components/menu-trigger-button"
import { PlayerOption } from "~/components/player-option"
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
import { showLinkCopiedToast } from "~/lib/toast-notifications"

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
  removeRequest?: LinkActionsRemoveRequest
  removeLabel?: string
}

export function LinkActionsDotMenu({
  itemLabel,
  onCopyLink,
  onOpenInPlayer,
  isPlayable = true,
  removeRequest,
  removeLabel = "Remove saved link",
}: LinkActionsDotMenuProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const handleCopy = () => {
    onCopyLink()
    showLinkCopiedToast()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <MenuTriggerButton
            type="button"
            look="media-row"
            onClick={(event) => event.stopPropagation()}
          >
            <HugeiconsIcon icon={EllipsisIcon} />
            <span className="sr-only">Open menu for {itemLabel}</span>
          </MenuTriggerButton>
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
              {removeLabel}
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
