import {
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { MenuTriggerButton } from "~/components/menu-trigger-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { showLinkCopiedToast } from "~/lib/toast-notifications"

interface ResolvableLinkMenuProps {
  itemLabel: string
  onCopyLink: () => void
  onRefresh: () => void
  onRemove: () => void
}

export const ResolvableLinkMenu = ({
  itemLabel,
  onCopyLink,
  onRefresh,
  onRemove,
}: ResolvableLinkMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <MenuTriggerButton look="media-row">
              <HugeiconsIcon icon={EllipsisIcon} />
              <span className="sr-only">Open menu for {itemLabel}</span>
            </MenuTriggerButton>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                onCopyLink()
                showLinkCopiedToast()
              }}
            >
              <HugeiconsIcon icon={CopyIcon} />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <HugeiconsIcon icon={Refresh01Icon} />
              Refresh
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Remove link
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationAlertDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        title="Remove this link?"
        description="This removes the link from the playable choices."
        confirmLabel="Remove link"
        confirmVariant="destructive"
        onConfirm={() => {
          onRemove()
          setIsRemoveDialogOpen(false)
        }}
      />
    </>
  )
}
