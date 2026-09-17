import {
  ArrowUpRight01Icon,
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  RefreshDotIcon,
  Image01Icon,
  SourceCodeSquareIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { PlayerOption } from "~/components/player-option"
import { Spinner } from "~/components/spinner"
import { Button } from "~/components/ui/button"
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
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { openInPlayerAndLogError } from "~/features/links/open-in-player"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { useShouldAutoSaveAllLinks } from "~/features/site/settings/auto-save-links-preference"
import { notifyClipboardWrite } from "~/lib/clipboard-events"
import {
  openInSpecificPlayerForHandoff,
  PLAYER_DEFINITIONS,
} from "~/lib/player-utils"
import { showErrorToast, showLinkCopiedToast } from "~/lib/toast-notifications"
import { cn } from "~/lib/utils"

import { ChangeArtworkDialog } from "./change-artwork-dialog"
import { LinkDebugLogDialog } from "./link-debug-log-dialog"
import { RemoveLinkAlertDialog } from "./remove-link-alert-dialog"

interface LinkItemMenuProps {
  item: LinkViewItem
  actions: LinkItemActions
  showRemove?: boolean
  onRemoved?: () => void
  playableLink?: ExtractedLink
  isPlayableLinkExpired?: boolean
  isRefreshing?: boolean
  triggerClassName?: string
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
}

export const LinkItemMenu = ({
  item,
  actions,
  showRemove = false,
  onRemoved,
  playableLink,
  isPlayableLinkExpired = false,
  isRefreshing = false,
  triggerClassName,
  menuOpen,
  onMenuOpenChange,
}: LinkItemMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false)
  const [isLogDialogOpen, setIsLogDialogOpen] = React.useState(false)
  const [isArtworkDialogOpen, setIsArtworkDialogOpen] = React.useState(false)
  const shouldAutoSaveAllLinks = useShouldAutoSaveAllLinks()
  const itemLabel = item.title || item.url
  const refreshActionLabel = shouldAutoSaveAllLinks
    ? "Refresh"
    : "Reload link choices"
  const refreshingLabel = shouldAutoSaveAllLinks
    ? `Refreshing ${itemLabel}…`
    : `Reloading link choices for ${itemLabel}…`
  const refreshLink = shouldAutoSaveAllLinks
    ? actions.softRefresh
    : actions.hardRefresh
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
      showLinkCopiedToast()
    } catch {
      showErrorToast({ title: "Unable to copy the link. Try again." })
    }
  }

  const removeItem = () => {
    actions.remove(item.url, item.id)
    onRemoved?.()
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={isRefreshing}
              aria-label={
                isRefreshing ? refreshingLabel : `Open menu for ${itemLabel}`
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
                {isRefreshing ? refreshingLabel : `Open menu for ${itemLabel}`}
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
              <DropdownMenuItem onClick={() => setIsLogDialogOpen(true)}>
                <HugeiconsIcon icon={SourceCodeSquareIcon} />
                Log
              </DropdownMenuItem>
              {actions.setArtwork && (
                <DropdownMenuItem onClick={() => setIsArtworkDialogOpen(true)}>
                  <HugeiconsIcon icon={Image01Icon} />
                  Change artwork
                </DropdownMenuItem>
              )}
              {!playableLink && (
                <DropdownMenuItem onClick={() => refreshLink(item.url)}>
                  <HugeiconsIcon icon={RefreshDotIcon} />
                  {refreshActionLabel}
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
                            const playableUrl =
                              getMediaNodeTargetOrUndefined(playableLink)
                            if (playableUrl === undefined) {
                              return
                            }
                            openInPlayerAndLogError(
                              () =>
                                openInSpecificPlayerForHandoff(
                                  playableUrl,
                                  player
                                ),
                              {
                                itemLabel: playableLink.label,
                                markOpened: () =>
                                  actions.markOpened(item.url, playableUrl),
                              }
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
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveLinkAlertDialog
        item={item}
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onRemove={removeItem}
      />
      <LinkDebugLogDialog
        item={item}
        open={isLogDialogOpen}
        onOpenChange={setIsLogDialogOpen}
      />
      <ChangeArtworkDialog
        item={item}
        open={isArtworkDialogOpen}
        onOpenChange={setIsArtworkDialogOpen}
        onSelect={(identity) => actions.setArtwork?.(item.url, identity)}
      />
    </>
  )
}
