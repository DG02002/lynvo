import * as React from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUpRight01Icon,
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  RefreshDotIcon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import type {
  DraftListItem,
  ExtractedLink,
  LinkViewItem,
} from "~/features/links/types"
import { RemoveLinkAlertDialog } from "./remove-link-alert-dialog"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { openInSpecificPlayer, PLAYER_DEFINITIONS } from "~/lib/player-utils"
import { PlayerOption } from "~/components/player-option"
import { notifyClipboardWrite } from "~/lib/clipboard-events"
import { deleteDraft } from "~/features/links/drafts"

interface LinkItemMenuProps {
  item: LinkViewItem | DraftListItem
  actions: LinkItemActions
  showRemove?: boolean
  onRemoved?: () => void
  playableLink?: ExtractedLink
  isPlayableLinkExpired?: boolean
  isRefreshing?: boolean
}

interface LinkItemMenuContentProps extends LinkItemMenuProps {
  variant: "draft" | "link"
}

const LinkItemMenuContent = ({
  item,
  actions,
  variant,
  showRemove = false,
  onRemoved,
  playableLink,
  isPlayableLinkExpired = false,
  isRefreshing = false,
}: LinkItemMenuContentProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false)
  const isDraft = variant === "draft"
  const itemLabel = item.title || item.url
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(item.url)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = item.url
        textArea.style.cssText = "position:fixed;left:-9999px;top:0"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }
      notifyClipboardWrite()
      toast.success("Link copied")
    } catch {
      toast.error("Unable to copy the link. Try again.")
    }
  }

  const removeItem = () => {
    if (isDraft) {
      deleteDraft(item.url)
    } else {
      void actions.remove(item.url, "id" in item ? item.id : undefined)
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
              disabled={isRefreshing}
              aria-label={
                isRefreshing
                  ? `Reloading link choices for ${itemLabel}…`
                  : `Open menu for ${itemLabel}`
              }
              className="size-8 text-foreground shrink-0 hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground"
            >
              {isRefreshing ? (
                <Spinner aria-hidden="true" />
              ) : (
                <HugeiconsIcon icon={EllipsisIcon} />
              )}
              <span className="sr-only">
                {isRefreshing
                  ? `Reloading link choices for ${itemLabel}…`
                  : `Open menu for ${itemLabel}`}
              </span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          {isDraft ? (
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setIsRemoveDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Remove draft
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <HugeiconsIcon icon={CopyIcon} />
                  Copy Source link
                </DropdownMenuItem>
                {!playableLink && (
                  <DropdownMenuItem
                    onClick={() => actions.hardRefresh(item.url)}
                  >
                    <HugeiconsIcon icon={RefreshDotIcon} />
                    Reload link choices
                  </DropdownMenuItem>
                )}
                {playableLink && !isPlayableLinkExpired && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <HugeiconsIcon icon={ArrowUpRight01Icon} />
                      Open in
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuGroup>
                        {PLAYER_DEFINITIONS.map((player) => (
                          <DropdownMenuItem
                            key={player.id}
                            onClick={() => {
                              actions.markOpened(item.url, playableLink.url)
                              void openInSpecificPlayer(
                                playableLink.url,
                                player
                              )
                            }}
                          >
                            <PlayerOption player={player} />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuGroup>
              {showRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setIsRemoveDialogOpen(true)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      Remove saved link
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveLinkAlertDialog
        item={item}
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onRemove={removeItem}
      />
    </>
  )
}

export const DraftLinkItemMenu = (
  props: Omit<LinkItemMenuProps, "item"> & { item: DraftListItem }
) => <LinkItemMenuContent {...props} variant="draft" />

export const LinkItemMenu = (
  props: Omit<LinkItemMenuProps, "item"> & { item: LinkViewItem }
) => <LinkItemMenuContent {...props} variant="link" />
