import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"
import {
  PackageIcon,
  PackageOpenIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { AnimatedStateIcon } from "~/components/animated-state-icon"
import { ExtractionWaitStatus } from "~/components/save-list/extraction-status"
import { FilenameText } from "~/components/filename-text"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import {
  MediaListRow,
  MediaListRowMeta,
  SaveListRowIcon,
} from "~/components/save-list/media-list-row"
import {
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  MEDIA_LIST_ROW_TITLE_CLASS,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
} from "~/components/save-list/media-list-row-constants"
import { ResolvableLinkMenu } from "~/components/save-list/resolvable-link-menu"
import { FinderEpisodeStill } from "~/components/save-list/finder-episode-still"
import { SaveListRowPoster } from "~/components/save-list/save-list-row-poster"
import { Spinner } from "~/components/spinner"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { openInSpecificPlayer } from "~/lib/player-utils"
import { cn } from "~/lib/utils"
import { getLinkKey, getResolvableSourceName } from "./save-list-browser-model"
import { useResolvableContainerState } from "./use-resolvable-container-state"

interface ResolvedMirrorRowsProps {
  readonly mirrors: readonly ExtractedLink[]
  readonly sourceLink: ExtractedLink
  readonly itemUrl: string
  readonly actions: LinkItemActions
  readonly shouldShowRowPosters?: boolean
}

interface ResolvableContainerEpisodeStill {
  readonly label: string
  readonly parentFolderName?: string
}

interface ResolvableContainerRowProps {
  readonly item: LinkViewItem
  readonly link: ExtractedLink
  readonly actions: LinkItemActions
  readonly isResolving: boolean
  readonly onRemove: () => void
  readonly shouldShowRowPosters?: boolean
  readonly episodeStill?: ResolvableContainerEpisodeStill
}

interface ResolvableContainerRowIconProps {
  readonly episodeStill?: ResolvableContainerEpisodeStill
  readonly shouldShowRowPosters: boolean
  readonly containerIcon: ReactNode
  readonly shouldShowResolving: boolean
  readonly linkLabel: string
  readonly isWatched: boolean
}

const ResolvableContainerRowIcon = ({
  episodeStill,
  shouldShowRowPosters,
  containerIcon,
  shouldShowResolving,
  linkLabel,
  isWatched,
}: ResolvableContainerRowIconProps) => {
  if (episodeStill) {
    return (
      <FinderEpisodeStill
        label={episodeStill.label}
        parentFolderName={episodeStill.parentFolderName}
        fallbackIcon={containerIcon}
        isResolving={shouldShowResolving}
        isWatched={isWatched}
      />
    )
  }

  if (shouldShowRowPosters) {
    return (
      <SaveListRowPoster
        label={linkLabel}
        isContainer
        fallbackIcon={containerIcon}
      />
    )
  }

  return <SaveListRowIcon>{containerIcon}</SaveListRowIcon>
}

const ResolvedMirrorRows = ({
  mirrors,
  sourceLink,
  itemUrl,
  actions,
  shouldShowRowPosters = false,
}: ResolvedMirrorRowsProps) => (
  <div
    className="stagger-children relative flex flex-col divide-y divide-border/50 border-t border-border/70 bg-muted/60 ps-12 md:ps-14"
    data-container-children
  >
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 start-9 z-10 w-0.5 bg-sky-500 md:start-11"
      data-container-connector
    />
    {mirrors.map((mirror) => {
      const mirrorTarget = getMediaNodeTarget(mirror)
      const playMirror = async () => {
        const result = await actions.play(mirror)
        markAfterAcceptedHandoff({
          ...result,
          itemLabel: mirror.label,
          markOpened: () =>
            actions.markOpened(itemUrl, getMediaNodeTarget(sourceLink)),
        })
      }
      const mirrorIcon = <HugeiconsIcon icon={PlayIcon} className="size-6" />
      return (
        <div key={getLinkKey(mirror)} className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -start-3 top-1/2 z-10 h-0.5 w-3 -translate-y-1/2 bg-sky-500"
            data-container-connector
          />
          <MediaListRow
            wrapperClassName="border-b-0"
            buttonClassName="min-h-20 bg-transparent py-4 hover:bg-muted/80"
            icon={
              shouldShowRowPosters ? (
                <SaveListRowPoster
                  label={sourceLink.label}
                  isContainer
                  fallbackIcon={mirrorIcon}
                />
              ) : (
                <SaveListRowIcon>{mirrorIcon}</SaveListRowIcon>
              )
            }
            title={
              <FilenameText
                value={mirror.label}
                className={MEDIA_LIST_ROW_TITLE_CLASS}
              />
            }
            trailing={
              mirror.size ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {mirror.size}
                </span>
              ) : undefined
            }
            overlay={
              <LinkActionsDotMenu
                itemLabel={mirror.label}
                onCopyLink={() =>
                  void navigator.clipboard.writeText(mirrorTarget)
                }
                onOpenInPlayer={async (player) => {
                  const result = await openInSpecificPlayer(
                    mirrorTarget,
                    player
                  )
                  markAfterAcceptedHandoff({
                    accepted: result.expectsNavigation,
                    itemLabel: mirror.label,
                    markOpened: () =>
                      actions.markOpened(
                        itemUrl,
                        getMediaNodeTarget(sourceLink)
                      ),
                  })
                }}
                className={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
              />
            }
            onActivate={() => void playMirror().catch(console.error)}
          />
        </div>
      )
    })}
  </div>
)

const getResolvableContainerIconState = (
  hasMirrors: boolean,
  isExpanded: boolean
) => {
  if (!hasMirrors) {
    return { stateKey: "search", icon: PackageSearchIcon }
  }

  if (isExpanded) {
    return { stateKey: "open", icon: PackageOpenIcon }
  }

  return { stateKey: "closed", icon: PackageIcon }
}

export const ResolvableContainerRow = ({
  item,
  link,
  actions,
  isResolving,
  onRemove,
  shouldShowRowPosters = false,
  episodeStill,
}: ResolvableContainerRowProps) => {
  const linkTarget = getMediaNodeTarget(link)
  const {
    mirrors,
    isExpanded,
    didResolutionFail,
    displaySize,
    resolutionState: resolvedState,
    isResolving: isStateResolving,
    openLink,
    refreshLink,
  } = useResolvableContainerState({ item, link, actions })
  const shouldShowResolving = isResolving || isStateResolving
  const resolutionState = shouldShowResolving ? "resolving" : resolvedState
  const { stateKey: containerIconStateKey, icon: containerIconDefinition } =
    getResolvableContainerIconState(mirrors.length > 0, isExpanded)
  const containerIcon = shouldShowResolving ? (
    <Spinner
      aria-label={`Loading playable links for ${link.label}…`}
      className="size-6"
    />
  ) : (
    <AnimatedStateIcon stateKey={containerIconStateKey}>
      <HugeiconsIcon icon={containerIconDefinition} className="size-6" />
    </AnimatedStateIcon>
  )

  return (
    <div
      className={cn(
        "flex flex-col border-b last:border-b-0",
        SAVE_LIST_ROW_ENTER_ANIMATION_CLASS
      )}
    >
      <MediaListRow
        wrapperClassName={cn(
          "border-b-0",
          isExpanded && !link.opened && "bg-muted/60",
          didResolutionFail && "bg-destructive/15"
        )}
        isOpened={link.opened === true}
        shouldStackIconOnMobile={Boolean(episodeStill)}
        buttonClassName={cn(
          isExpanded && !link.opened && "bg-transparent hover:bg-muted/80",
          didResolutionFail && "bg-destructive/15 hover:bg-destructive/20"
        )}
        buttonDataAttributes={{
          "data-resolution-state": resolutionState,
        }}
        icon={
          <ResolvableContainerRowIcon
            episodeStill={episodeStill}
            shouldShowRowPosters={shouldShowRowPosters}
            containerIcon={containerIcon}
            shouldShowResolving={shouldShowResolving}
            linkLabel={link.label}
            isWatched={link.opened === true}
          />
        }
        title={
          <ExtractionWaitStatus
            isWaiting={shouldShowResolving}
            didFail={didResolutionFail}
            titleClassName={MEDIA_LIST_ROW_TITLE_CLASS}
          >
            <FilenameText
              value={link.label}
              className={MEDIA_LIST_ROW_TITLE_CLASS}
            />
          </ExtractionWaitStatus>
        }
        meta={
          <MediaListRowMeta
            sourceName={getResolvableSourceName(link, item)}
            size={displaySize}
          />
        }
        trailing={!link.opened ? <NewBadge /> : undefined}
        overlay={
          <ResolvableLinkMenu
            itemLabel={link.label}
            onCopyLink={() => void navigator.clipboard.writeText(linkTarget)}
            onRefresh={refreshLink}
            onRemove={onRemove}
            triggerClassName={MEDIA_LIST_ROW_MENU_TRIGGER_CLASS}
          />
        }
        onActivate={openLink}
      />
      {mirrors.length > 0 && isExpanded && (
        <ResolvedMirrorRows
          mirrors={mirrors}
          sourceLink={link}
          itemUrl={item.url}
          actions={actions}
          shouldShowRowPosters={shouldShowRowPosters && !episodeStill}
        />
      )}
    </div>
  )
}
