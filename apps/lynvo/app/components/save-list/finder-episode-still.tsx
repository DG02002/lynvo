import { useMemo } from "react"
import type { ReactNode } from "react"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { getMediaArtworkRequest } from "~/features/links/media-artwork/media-artwork-identity"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { cn } from "~/lib/utils"
import { Spinner } from "~/components/spinner"

interface FinderEpisodeStillProps {
  readonly label: string
  readonly parentFolderName?: string
  readonly fallbackIcon: ReactNode
  readonly isResolving?: boolean
  readonly isDimmed?: boolean
}

export const FinderEpisodeStill = ({
  label,
  parentFolderName,
  fallbackIcon,
  isResolving = false,
  isDimmed = false,
}: FinderEpisodeStillProps) => {
  const artworkRequest = useMemo(
    () => getMediaArtworkRequest(label, parentFolderName),
    [label, parentFolderName]
  )
  const artwork = useMediaArtwork(artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath

  return (
    <span
      className={cn("block w-full shrink-0 md:w-96", isDimmed && "opacity-60")}
    >
      <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-foreground/15 bg-muted/60">
        {imagePath ? (
          <TmdbImage path={imagePath} variant="card" alt="" />
        ) : (
          fallbackIcon
        )}
        {isResolving && (
          <span className="absolute inset-0 z-1 flex items-center justify-center bg-background/60">
            <Spinner aria-label={`Loading ${label}…`} className="size-6" />
          </span>
        )}
      </span>
    </span>
  )
}
