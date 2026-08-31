import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"
import {
  PackageIcon,
  PackageOpenIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { AnimatedStateIcon } from "~/components/animated-state-icon"
import { getExtractionWaitStatusInput } from "~/components/save-list/extraction-status-utils"
import { LinkActionsDotMenu } from "~/components/links/link-actions-context-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import {
  MediaListRow,
  MediaListRowMeta,
  SaveListRowIcon,
} from "~/components/save-list/media-list-row"
import {
  MEDIA_LIST_ROW_MENU_TRIGGER_CLASS,
  SAVE_LIST_ROW_ENTER_ANIMATION_CLASS,
} from "~/components/save-list/media-list-row-constants"
import { MEDIA_LIST_EPISODE_STILL_SLOT_CLASS } from "~/components/save-list/save-list-layout-constants"
import { ResolvableLinkMenu } from "~/components/save-list/resolvable-link-menu"
import { FinderEpisodeStill } from "~/components/save-list/finder-episode-still"
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
  readonly episodeStill?: ResolvableContainerEpisodeStill
  readonly displayTitle?: string
}

interface ResolvableContainerRowIconProps {
  readonly episodeStill?: ResolvableContainerEpisodeStill
  readonly containerIcon: ReactNode
  readonly shouldShowResolving: boolean
  readonly isWatched: boolean
}

const ResolvableContainerRowIcon = ({
  episodeStill,
  containerIcon,
  shouldShowResolving,
  isWatched,
}: ResolvableContainerRowIconProps) => {
  if (episodeStill) {
    return (
      <>
        <span className={MEDIA_LIST_EPISODE_STILL_SLOT_CLASS}>
          <FinderEpisodeStill
            label={episodeStill.label}
            parentFolderName={episodeStill.parentFolderName}
            fallbackIcon={containerIcon}
            isResolving={shouldShowResolving}
            isWatched={isWatched}
          />
        </span>
        <span className="md:hidden">
          <SaveListRowIcon>{containerIcon}</SaveListRowIcon>
        </span>
      </>
    )
  }

  return <SaveListRowIcon>{containerIcon}</SaveListRowIcon>
}

const ResolvedMirrorRows = ({
  mirrors,
  sourceLink,
  itemUrl,
  actions,
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
            buttonClassName="group-hover:bg-muted/80"
            contentClassName="min-h-20 py-4"
            icon={<SaveListRowIcon>{mirrorIcon}</SaveListRowIcon>}
            title={{ value: mirror.label }}
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
  episodeStill,
  displayTitle,
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
        wrapperClassName="border-b-0"
        isOpened={link.opened === true}
        buttonClassName={cn(
          isExpanded && !link.opened && "bg-muted/60 group-hover:bg-muted/80",
          didResolutionFail && "bg-destructive/15 group-hover:bg-destructive/20"
        )}
        buttonDataAttributes={{
          "data-resolution-state": resolutionState,
        }}
        icon={
          <ResolvableContainerRowIcon
            episodeStill={episodeStill}
            containerIcon={containerIcon}
            shouldShowResolving={shouldShowResolving}
            isWatched={link.opened === true}
          />
        }
        title={{ value: displayTitle ?? link.label }}
        titleExtractionStatus={{
          status: getExtractionWaitStatusInput(
            shouldShowResolving,
            didResolutionFail
          ),
        }}
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
        />
      )}
    </div>
  )
}
