import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { FilenameText } from "~/components/filename-text"
import { ImmersiveBackButton } from "~/components/save-list/immersive-back-button"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { Spinner } from "~/components/spinner"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { toLinkViewModel } from "~/features/links/link-view-models"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { getHybridItemLabel } from "~/features/links/media-artwork/hybrid-card-grouping"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { SaveExtractionStatus } from "./extraction-status"
import {
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
  MediaListRow,
  MediaListRowMeta,
  SaveListRowIcon,
} from "./media-list-row"
import { NewBadge } from "./new-badge"
import { PlayableExpiryBadge } from "./playable-expiry-badge"

interface HybridGroupItemRowProps {
  readonly item: LinkListItem
  readonly actions: LinkItemActions
  readonly isExtracting: boolean
  readonly currentTimeMs: number
  readonly onOpenItem: (itemUrl: string) => void
}

const HybridGroupItemRow = ({
  item,
  actions,
  isExtracting,
  currentTimeMs,
  onOpenItem,
}: HybridGroupItemRowProps) => {
  const interactionState = getSavedLinkInteractionState(item, currentTimeMs)
  const { directLink, isDirectLinkExpired } = interactionState
  const extractionState = item.extractionStatus?.state ?? "complete"
  const isExtractionIncomplete = extractionState !== "complete"
  const itemLabel = getHybridItemLabel(item)
  const view = toLinkViewModel(item)
  const directLinkTarget = directLink
    ? getMediaNodeTargetOrUndefined(directLink)
    : undefined

  const handleActivate = () => {
    if (isExtractionIncomplete) {
      return
    }
    if (directLink) {
      void actions
        .play(directLink)
        .then((result) =>
          markAfterAcceptedHandoff({
            ...result,
            itemLabel: directLink.label,
            markOpened: () => {
              if (directLinkTarget !== undefined) {
                actions.markOpened(item.url, directLinkTarget)
              }
            },
          })
        )
        .catch(console.error)
      return
    }
    actions.markOpened(item.url, item.url)
    onOpenItem(item.url)
  }

  return (
    <MediaListRow
      icon={
        isExtractionIncomplete ? (
          <SaveListRowIcon>
            {extractionState === "failed" ? (
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
            ) : (
              <Spinner aria-hidden="true" className="size-6" />
            )}
          </SaveListRowIcon>
        ) : (
          <SaveListRowIcon
            className={
              isDirectLinkExpired ? "text-muted-foreground" : undefined
            }
          >
            <HugeiconsIcon
              icon={directLink ? PlayIcon : Folder01Icon}
              className="size-6"
            />
          </SaveListRowIcon>
        )
      }
      title={
        <SaveExtractionStatus item={item} isRefreshing={isExtracting} isTitle>
          <FilenameText
            value={itemLabel}
            className={MEDIA_LIST_ROW_TITLE_CLASS}
            textClassName={isDirectLinkExpired ? "line-through" : undefined}
          />
        </SaveExtractionStatus>
      }
      meta={
        <>
          <MediaListRowMeta
            sourceName={view.sourceName || view.pluginName || item.url}
            size={directLink?.size}
            itemCount={directLink ? undefined : view.extractedLinks.length}
          />
          {directLink?.expiry !== undefined && (
            <PlayableExpiryBadge
              expiresAt={directLink.expiry}
              expirySource={directLink.expirySource}
            />
          )}
        </>
      }
      trailing={
        !isDirectLinkExpired &&
        !isExtractionIncomplete &&
        interactionState.isNew ? (
          <NewBadge />
        ) : undefined
      }
      overlay={
        <LinkItemMenu
          item={item}
          actions={actions}
          playableLink={directLink}
          isPlayableLinkExpired={isDirectLinkExpired}
          showRemove
          isRefreshing={isExtracting}
          triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
        />
      }
      onActivate={handleActivate}
      disabled={directLink !== undefined && isDirectLinkExpired}
      isOpened={directLink?.opened === true}
    />
  )
}

interface HybridGroupBrowserProps {
  readonly group: HybridCardGroup
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly currentTimeMs?: number
  readonly onExit: () => void
  readonly onOpenItem: (itemUrl: string) => void
}

export const HybridGroupBrowser = ({
  group,
  actions,
  extractingItems,
  currentTimeMs = Date.now(),
  onExit,
  onOpenItem,
}: HybridGroupBrowserProps) => {
  const artwork = useMediaArtwork(group.artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const isArtworkPending =
    group.artworkRequest !== undefined && artwork === undefined

  return (
    <section className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex min-h-16 shrink-0 items-stretch border-b bg-background md:hidden">
        <div className="w-16 shrink-0">
          <ImmersiveBackButton onExit={onExit} />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[8rem_minmax(0,22rem)_minmax(0,1fr)] md:grid-rows-1">
        <div className="hidden md:block">
          <Button
            variant="ghost"
            onClick={onExit}
            className="size-full justify-center rounded-none px-4 text-lg font-foreground hover:bg-muted/70 hover:text-foreground md:border-r"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              className="size-6 text-foreground"
              data-icon="inline-start"
            />
            Back
          </Button>
        </div>
        <div className="border-b p-4 md:block md:border-b-0 md:border-r md:p-6">
          <div className="mx-auto w-80 md:mx-0 md:w-full">
            <div className="relative aspect-2/3 overflow-hidden rounded-2xl border border-foreground/15 bg-muted">
              {imagePath ? (
                <TmdbImage
                  path={imagePath}
                  variant="card"
                  imageType={artwork?.stillPath ? "still" : "poster"}
                  sizes="(min-width: 768px) 22rem, 20rem"
                  alt={`Artwork for ${group.displayTitle}`}
                  width={342}
                  height={513}
                />
              ) : isArtworkPending ? (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15">
                  <Spinner
                    aria-label={`Loading artwork for ${group.displayTitle}…`}
                  />
                </div>
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15 text-sm text-muted-foreground">
                  No poster found
                </div>
              )}
            </div>
            <h2 className="hidden pt-3 text-center font-heading text-base font-normal break-words md:block">
              {group.displayTitle}
            </h2>
          </div>
          <h1
            aria-label={group.displayTitle}
            className="mt-3 text-center font-heading text-lg font-normal break-words md:hidden"
          >
            {group.displayTitle}
          </h1>
        </div>
        <div className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain">
          <div className="stagger-children flex flex-col divide-y divide-border/70">
            {group.items.map((item) => (
              <HybridGroupItemRow
                key={item.id ?? item.url}
                item={item}
                actions={actions}
                isExtracting={extractingItems.has(item.url)}
                currentTimeMs={currentTimeMs}
                onOpenItem={onOpenItem}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
