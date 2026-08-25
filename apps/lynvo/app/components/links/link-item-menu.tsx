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
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { RemoveLinkAlertDialog } from "./remove-link-alert-dialog"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { openInSpecificPlayer, PLAYER_DEFINITIONS } from "~/lib/player-utils"
import { PlayerOption } from "~/components/player-option"
import { notifyClipboardWrite } from "~/lib/clipboard-events"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { cn } from "~/lib/utils"

interface LinkItemMenuProps {
  item: LinkViewItem
  actions: LinkItemActions
  showRemove?: boolean
  onRemoved?: () => void
  playableLink?: ExtractedLink
  isPlayableLinkExpired?: boolean
  isRefreshing?: boolean
  triggerClassName?: string
}

const LinkItemMenuContent = ({
  item,
  actions,
  showRemove = false,
  onRemoved,
  playableLink,
  isPlayableLinkExpired = false,
  isRefreshing = false,
  triggerClassName,
}: LinkItemMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false)
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
    void actions.remove(item.url, item.id)
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
              className={cn(
                "size-8 shrink-0 text-foreground! hover:bg-transparent hover:text-foreground! aria-expanded:bg-transparent aria-expanded:text-foreground!",
                triggerClassName
              )}
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
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleCopyLink}>
                <HugeiconsIcon icon={CopyIcon} />
                Copy Source link
              </DropdownMenuItem>
              {!playableLink && (
                <DropdownMenuItem onClick={() => actions.hardRefresh(item.url)}>
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
                          onClick={async () => {
                            const playableUrl = getMediaNodeTarget(playableLink)
                            const result = await openInSpecificPlayer(
                              playableUrl,
                              player
                            )
                            markAfterAcceptedHandoff({
                              accepted: result.expectsNavigation,
                              itemLabel: playableLink.label,
                              markOpened: () =>
                                actions.markOpened(item.url, playableUrl),
                            })
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

export const LinkItemMenu = (
  props: Omit<LinkItemMenuProps, "item"> & { item: LinkViewItem }
) => <LinkItemMenuContent {...props} />
