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
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import { RemoveRecentAlertDialog } from "./remove-recent-alert-dialog"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import {
  openInSpecificPlayer,
  PLAYER_DEFINITIONS,
  PlayerOption,
} from "~/lib/player-utils"
import { notifyClipboardWrite } from "~/lib/clipboard-events"
import { deleteDraft } from "./DraftManager"

interface CardDotMenuProps {
  item: RecentLinkViewItem
  actions: LinkCardActions
  isDraft?: boolean
  showRemove?: boolean
  onRemoved?: () => void
  playableLink?: ExtractedLink
  isRefreshing?: boolean
}

export function CardDotMenu({
  item,
  actions,
  isDraft = false,
  showRemove = false,
  onRemoved,
  playableLink,
  isRefreshing = false,
}: CardDotMenuProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false)
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
      toast.success("Copied")
    } catch {
      toast.error("Unable to copy the link. Try again.")
    }
  }

  const removeItem = () => {
    if (isDraft) {
      deleteDraft(item.url)
    } else {
      void actions.remove(item.url, item.id)
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
              aria-label={isRefreshing ? "Re-selecting links" : "Open menu"}
              className="size-8 text-foreground shrink-0 hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground"
            >
              {isRefreshing ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={EllipsisIcon} />
              )}
              <span className="sr-only">
                {isRefreshing ? "Re-selecting links" : "Open menu"}
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
                Remove Draft
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <HugeiconsIcon icon={CopyIcon} />
                  Copy Source Link
                </DropdownMenuItem>
                {!playableLink && (
                  <DropdownMenuItem
                    onClick={() => actions.hardRefresh(item.url)}
                  >
                    <HugeiconsIcon icon={RefreshDotIcon} />
                    Re-Select Links
                  </DropdownMenuItem>
                )}
                {playableLink && (
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
                              actions.markWatched(item.url, playableLink.url)
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
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveRecentAlertDialog
        item={item}
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onRemove={removeItem}
      />
    </>
  )
}
