import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, EllipsisIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { formatItemCount } from "~/lib/format-item-count"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { MEDIA_LIST_ROW_MENU_TRIGGER_CLASS } from "./media-list-row-constants"

interface HybridGroupMenuProps {
  readonly group: HybridCardGroup
  readonly actions: LinkItemActions
  readonly onExit: () => void
}

export const HybridGroupMenu = ({
  group,
  actions,
  onExit,
}: HybridGroupMenuProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const itemCountLabel = formatItemCount(group.items.length)

  const removeAllItems = () => {
    for (const item of group.items) {
      actions.remove(item.url, item.id)
    }
    onExit()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Open menu for ${group.displayTitle}`}
              className={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
            >
              <HugeiconsIcon icon={EllipsisIcon} />
              <span className="sr-only">
                Open menu for {group.displayTitle}
              </span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Delete all
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationAlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Remove ${itemCountLabel} from your list?`}
        description={`This removes every saved link grouped under ${group.displayTitle}. You can save them again from their source links.`}
        confirmLabel="Delete all"
        confirmVariant="destructive"
        onConfirm={() => {
          removeAllItems()
          setIsDeleteDialogOpen(false)
        }}
      />
    </>
  )
}
