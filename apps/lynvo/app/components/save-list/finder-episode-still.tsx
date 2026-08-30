import { useMemo, type ReactNode } from "react"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { getMediaArtworkRequest } from "~/features/links/media-artwork/media-artwork-identity"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { cn } from "~/lib/utils"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/spinner"

interface FinderEpisodeStillProps {
  readonly label: string
  readonly parentFolderName?: string
  readonly fallbackIcon: ReactNode
  readonly isResolving?: boolean
  readonly isDimmed?: boolean
  readonly isWatched?: boolean
}

interface FinderEpisodeStillImageProps {
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isLookupPending: boolean
  readonly fallbackIcon: ReactNode
}

interface FinderEpisodeStillLookupState {
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
        sizes="(min-width: 768px) 24rem, calc(100vw - 1.5rem)"
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

  return { artwork, imagePath, imageType, isLookupPending }
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
      className={cn("block w-full shrink-0 md:w-96", isDimmed && "opacity-60")}
    >
      <span
        className={cn(
          "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-foreground/15 bg-muted/60",
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
      </span>
    </span>
  )
}

export const FinderEpisodeStill = ({
  label,
  parentFolderName,
  fallbackIcon,
  isResolving = false,
  isDimmed = false,
  isWatched = false,
}: FinderEpisodeStillProps) => {
  const { imagePath, imageType, isLookupPending } = useFinderEpisodeStill(
    label,
    parentFolderName
  )

  return (
    <FinderEpisodeStillDisplay
      label={label}
      fallbackIcon={fallbackIcon}
      isResolving={isResolving}
      isDimmed={isDimmed}
      isWatched={isWatched}
      imagePath={imagePath}
      imageType={imageType}
      isLookupPending={isLookupPending}
    />
  )
}
