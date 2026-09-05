import { useMemo, type ReactNode } from "react"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import {
  getMediaEpisodeDisplayTitle,
  getMediaArtworkRequest,
} from "~/features/links/media-artwork/media-artwork-identity"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { cn } from "~/lib/utils"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/spinner"
import {
  HYBRID_GROUP_EPISODE_STILL_SLOT_CLASS,
  MEDIA_LIST_EPISODE_STILL_SLOT_CLASS,
  MEDIA_LIST_EPISODE_STILL_CLASS,
  MEDIA_LIST_EPISODE_STILL_SIZES,
} from "./save-list-layout-constants"

interface FinderEpisodeStillImageProps {
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isLookupPending: boolean
  readonly fallbackIcon: ReactNode
}

interface FinderEpisodeStillLookupState {
  readonly episodeDisplayTitle: string
  readonly artwork: MediaArtworkResult | undefined
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isLookupPending: boolean
}

interface FinderEpisodeStillDisplayProps {
  readonly label: string
  readonly fallbackIcon: ReactNode
  readonly isResolving: boolean
  readonly isDimmed: boolean
  readonly isWatched: boolean
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isLookupPending: boolean
}

const FinderEpisodeStillImage = ({
  imagePath,
  imageType,
  isLookupPending,
  fallbackIcon,
}: FinderEpisodeStillImageProps) => {
  if (imagePath) {
    return (
      <TmdbImage
        path={imagePath}
        variant="wide-card"
        imageType={imageType}
        sizes={MEDIA_LIST_EPISODE_STILL_SIZES}
        alt=""
      />
    )
  }

  if (isLookupPending) {
    return <Skeleton className="absolute inset-0 size-full" />
  }

  return fallbackIcon
}

export const useFinderEpisodeStill = (
  label: string,
  parentFolderName?: string,
  isEnabled = true
): FinderEpisodeStillLookupState => {
  const artworkRequest = useMemo(
    () =>
      isEnabled ? getMediaArtworkRequest(label, parentFolderName) : undefined,
    [isEnabled, label, parentFolderName]
  )
  const artwork = useMediaArtwork(artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const imageType = artwork?.stillPath ? "still" : "poster"
  const isLookupPending = artworkRequest !== undefined && artwork === undefined

  return {
    artwork,
    imagePath,
    imageType,
    isLookupPending,
    episodeDisplayTitle: getMediaEpisodeDisplayTitle(
      label,
      artwork?.episodeTitle,
      parentFolderName
    ),
  }
}

export const FinderEpisodeStillDisplay = ({
  label,
  fallbackIcon,
  isResolving,
  isDimmed,
  isWatched,
  imagePath,
  imageType,
  isLookupPending,
}: FinderEpisodeStillDisplayProps) => {
  return (
    <span
      className={cn(MEDIA_LIST_EPISODE_STILL_CLASS, isDimmed && "opacity-60")}
    >
      <span
        className={cn(
          "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-foreground/15 bg-muted/60 shadow-depth-s",
          isWatched && "grayscale"
        )}
      >
        <FinderEpisodeStillImage
          imagePath={imagePath}
          imageType={imageType}
          isLookupPending={isLookupPending}
          fallbackIcon={fallbackIcon}
        />
        {isResolving && (
          <span className="absolute inset-0 z-1 flex items-center justify-center bg-background/60">
            <Spinner aria-label={`Loading ${label}…`} className="size-6" />
          </span>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-depth-gloss"
        />
      </span>
    </span>
  )
}

// Resolution changes the action, not the episode's responsive presentation.
export const EpisodeStillSlot = ({
  stackOnMobile,
  children,
  mobileFallback,
}: {
  readonly stackOnMobile: boolean
  readonly children: ReactNode
  readonly mobileFallback: ReactNode
}) => (
  <>
    <span
      className={
        stackOnMobile
          ? HYBRID_GROUP_EPISODE_STILL_SLOT_CLASS
          : MEDIA_LIST_EPISODE_STILL_SLOT_CLASS
      }
    >
      {children}
    </span>
    {!stackOnMobile && <span className="md:hidden">{mobileFallback}</span>}
  </>
)
