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
import { LinkItemMenu } from "~/components/links/link-item-menu"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import { cn } from "~/lib/utils"

interface TitleGroupMenuProps {
  readonly group: TitleGroupProjection
  readonly savedLinks: readonly LinkListItem[]
  readonly actions: LinkItemActions
  readonly onRemoved?: () => void
  readonly fallbackItem?: LinkListItem
  readonly playableLink?: ExtractedLink
  readonly isPlayableLinkExpired?: boolean
  readonly triggerClassName?: string
}

interface RemoveTitleGroupDialogProps {
  readonly group: TitleGroupProjection
  readonly savedLinks: readonly LinkListItem[]
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onRemove: () => void
}

const RemoveTitleGroupDialog = ({
  group,
  savedLinks,
  open,
  onOpenChange,
  onRemove,
}: RemoveTitleGroupDialogProps) => (
  <ConfirmationAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title={`Remove ${savedLinks.length} saved links?`}
    description={`This removes every saved link for ${group.displayTitle} from your list. You can save them again from their source links.`}
    confirmLabel="Remove links"
    confirmVariant="destructive"
    onConfirm={() => {
      onRemove()
      onOpenChange(false)
    }}
  />
)

export const TitleGroupMenu = ({
  group,
  savedLinks,
  actions,
  onRemoved,
  fallbackItem,
  playableLink,
  isPlayableLinkExpired = false,
  triggerClassName,
}: TitleGroupMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  if (savedLinks.length <= 1) {
    const singleItem = savedLinks[0] ?? fallbackItem
    if (!singleItem) {
      return null
    }
    return (
      <LinkItemMenu
        item={singleItem}
        actions={actions}
        showRemove
        onRemoved={onRemoved}
        playableLink={playableLink}
        isPlayableLinkExpired={isPlayableLinkExpired}
        triggerClassName={triggerClassName}
      />
    )
  }

  const removeGroupLinks = () => {
    for (const savedLink of savedLinks) {
      actions.remove(savedLink.url, savedLink.id)
    }
    onRemoved?.()
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
              className={cn(
                "size-8 shrink-0 text-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground",
                triggerClassName
              )}
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
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Remove saved links
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveTitleGroupDialog
        group={group}
        savedLinks={savedLinks}
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onRemove={removeGroupLinks}
      />
    </>
  )
}
