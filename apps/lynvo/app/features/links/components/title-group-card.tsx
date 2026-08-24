import { Link } from "react-router"
import { LinkItemMenu } from "~/components/links/link-item-menu"
import { NewBadge } from "~/components/save-list/new-badge"
import { Skeleton } from "~/components/ui/skeleton"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { getMediaNodeTarget } from "~/features/links/media-node-interaction"
import { getSavedLinkInteractionState } from "~/features/links/saved-link-interaction"
import type { LinkListItem } from "~/features/links/types"
import { getTitleGroupHref } from "~/features/links/title-grouping/title-group-href"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { markAfterAcceptedHandoff } from "~/lib/opened-confirmation-events"
import { cn } from "~/lib/utils"

interface TitleGroupCardProps {
  readonly group: TitleGroupProjection
  readonly item?: LinkListItem
  readonly actions?: LinkItemActions
}

const PosterCard = ({ group, item, actions }: TitleGroupCardProps) => {
  const interactionState = item
    ? getSavedLinkInteractionState(item, Date.now())
    : undefined
  const directLink = interactionState?.directLink
  const isDirectLinkExpired = interactionState?.isDirectLinkExpired ?? false
  const isNew = interactionState?.isNew ?? false
  const isMetadataPending = group.metadataState === "pending"
  const titleGroupPath = group.id
    ? getTitleGroupHref(group.id, group.mediaKind)
    : undefined

  const handleDirectPlay = async () => {
    if (!actions || !directLink || isDirectLinkExpired) {
      return
    }
    const currentDirectLinkTarget = getMediaNodeTarget(directLink)
    try {
      const result = await actions.play(directLink)
      if (item) {
        markAfterAcceptedHandoff({
          ...result,
          itemLabel: directLink.label,
          markOpened: () =>
            actions.markOpened(item.url, currentDirectLinkTarget),
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <article
      data-flip-key={group.identityKey}
      data-testid="title-group-card"
      data-layout-guide-target="library-card"
      className="group relative w-full animate-in fade-in fill-mode-both slide-in-from-bottom-4 zoom-in-95 duration-500 motion-reduce:animate-none"
    >
      {titleGroupPath && !isDirectLinkExpired ? (
        <Link
          to={titleGroupPath}
          className="absolute inset-0 z-1 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Open ${directLink?.label || group.displayTitle}`}
        />
      ) : directLink ? (
        <button
          type="button"
          disabled={isDirectLinkExpired}
          onClick={() => void handleDirectPlay()}
          className="absolute inset-0 z-1 cursor-pointer rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed"
          aria-label={`Open ${directLink.label || group.displayTitle}`}
        />
      ) : null}
      <div
        className={cn(
          "relative aspect-2/3 overflow-hidden rounded-3xl border border-foreground/15 bg-muted",
          "group-hover:border-foreground/25 group-has-[:focus-visible]:border-foreground/25 has-aria-expanded:border-foreground/25"
        )}
      >
        {isMetadataPending ? (
          <Skeleton className="size-full" />
        ) : group.posterPath ? (
          <TmdbImage
            path={group.posterPath}
            variant="card"
            alt={`Poster for ${group.displayTitle}`}
            width={342}
            height={513}
          />
        ) : (
          <div className="flex size-full items-end bg-gradient-to-br from-muted to-muted-foreground/15 p-4">
            <span className="font-heading text-lg font-normal leading-tight text-foreground">
              {group.displayTitle}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/20 group-has-[:focus-visible]:bg-black/20 group-has-aria-expanded:bg-black/20 motion-reduce:transition-none" />
        {isNew && !isMetadataPending && (
          <NewBadge className="absolute left-3 top-3 z-10" />
        )}
        {!isMetadataPending &&
          group.metadataState === "failed" &&
          !group.posterPath && (
            <span className="absolute right-2 top-2 rounded-full bg-destructive/90 px-2 py-1 text-[11px] font-medium text-destructive-foreground shadow-sm backdrop-blur-sm">
              Not found
            </span>
          )}
        {!isMetadataPending &&
          group.metadataState === "unavailable" &&
          !group.posterPath && (
            <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
              No artwork
            </span>
          )}
        {item && actions && (
          <div className="absolute bottom-4 right-4 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[:focus-visible]:opacity-100 has-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none [&_svg]:size-7!">
            <LinkItemMenu
              item={item}
              actions={actions}
              playableLink={directLink}
              isPlayableLinkExpired={isDirectLinkExpired}
              showRemove
              triggerClassName="size-10 rounded-full bg-background/80 shadow-none hover:bg-background/80 aria-expanded:bg-background/80 dark:hover:bg-background/80"
            />
          </div>
        )}
      </div>
      <div className="px-1 pt-3 text-center">
        {isMetadataPending ? (
          <Skeleton className="mx-auto h-5 w-3/4" />
        ) : (
          <h3 className="font-heading text-base font-normal break-words">
            {group.displayTitle}
          </h3>
        )}
      </div>
    </article>
  )
}

export const TitleGroupCard = ({
  group,
  item,
  actions,
}: TitleGroupCardProps) => {
  return <PosterCard group={group} item={item} actions={actions} />
}
