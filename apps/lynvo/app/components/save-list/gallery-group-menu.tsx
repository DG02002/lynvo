import { Delete02Icon, EllipsisIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import {
  MenuTriggerButton,
  type MenuTriggerLook,
} from "~/components/menu-trigger-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { GalleryGroup } from "~/features/links/media-artwork"
import { formatItemCount } from "~/lib/format-item-count"

interface GalleryGroupMenuProps {
  readonly group: GalleryGroup
  readonly actions: LinkItemActions
  readonly onExit?: () => void
  readonly triggerLook: MenuTriggerLook
  readonly menuOpen?: boolean
  readonly onMenuOpenChange?: (open: boolean) => void
}

export const GalleryGroupMenu = ({
  group,
  actions,
  onExit,
  triggerLook,
  menuOpen,
  onMenuOpenChange,
}: GalleryGroupMenuProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const itemCountLabel = formatItemCount(group.items.length)

  const removeAllItems = () => {
    for (const item of group.items) {
      actions.remove(item.url, item.id)
    }
    onExit?.()
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <MenuTriggerButton
              look={triggerLook}
              aria-label={`Open menu for ${group.displayTitle}`}
            >
              <HugeiconsIcon icon={EllipsisIcon} />
              <span className="sr-only">
                Open menu for {group.displayTitle}
              </span>
            </MenuTriggerButton>
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
        title={`Remove ${itemCountLabel} from your library?`}
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
