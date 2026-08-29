import { useMemo, type ReactNode } from "react"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { getMediaArtworkRequest } from "~/features/links/media-artwork/media-artwork-identity"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { cn } from "~/lib/utils"
import { SaveListRowIcon } from "./media-list-row"

interface SaveListRowPosterProps {
  readonly label: string
  readonly parentFolderName?: string
  readonly isContainer?: boolean
  readonly isIconWhenArtworkMissing?: boolean
  readonly fallbackIcon: ReactNode
  readonly isDimmed?: boolean
}

export const SaveListRowPoster = ({
  label,
  parentFolderName,
  isContainer = false,
  isIconWhenArtworkMissing = false,
  fallbackIcon,
  isDimmed = false,
}: SaveListRowPosterProps) => {
  const artworkRequest = useMemo(
    () => getMediaArtworkRequest(label, parentFolderName, { isContainer }),
    [label, parentFolderName, isContainer]
  )
  const artwork = useMediaArtwork(artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath

  if (!imagePath && isIconWhenArtworkMissing) {
    return (
      <SaveListRowIcon
        className={isDimmed ? "text-muted-foreground" : undefined}
      >
        {fallbackIcon}
      </SaveListRowIcon>
    )
  }

  return (
    <span className="flex w-10 shrink-0 justify-center md:w-14">
      <span
        className={cn(
          "relative flex aspect-2/3 w-full items-center justify-center overflow-hidden rounded-md border border-foreground/15 bg-muted/60",
          isDimmed && "opacity-60"
        )}
      >
        {imagePath ? (
          <TmdbImage
            path={imagePath}
            variant="card"
            sizes="(min-width: 768px) 3.5rem, 2.5rem"
            alt=""
          />
        ) : (
          fallbackIcon
        )}
      </span>
    </span>
  )
}
