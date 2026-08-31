import { Spinner } from "~/components/spinner"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { useMediaArtwork } from "~/features/links/media-artwork/use-media-artwork"
import { TMDB_LOGO_SHORT_SRC, TMDB_SITE_URL } from "~/lib/constants"
import { HYBRID_GROUP_ARTWORK_SIZES } from "./save-list-layout-constants"

interface SeasonArtworkPanelProps {
  readonly displayTitle: string
  readonly artworkRequest: MediaArtworkRequest | undefined
}

interface SeasonArtworkImageProps {
  readonly displayTitle: string
  readonly imagePath: string | undefined
  readonly imageType: "poster" | "still"
  readonly isArtworkPending: boolean
}

const SeasonArtworkImage = ({
  displayTitle,
  imagePath,
  imageType,
  isArtworkPending,
}: SeasonArtworkImageProps) => {
  if (imagePath) {
    return (
      <TmdbImage
        path={imagePath}
        variant="card"
        imageType={imageType}
        sizes={HYBRID_GROUP_ARTWORK_SIZES}
        alt={`Artwork for ${displayTitle}`}
        width={342}
        height={513}
      />
    )
  }

  if (isArtworkPending) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15">
        <Spinner
          aria-label={`Loading artwork for ${displayTitle}…`}
          className="size-8"
        />
      </div>
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15 text-sm text-muted-foreground">
      No poster found
    </div>
  )
}

export const SeasonArtworkPanel = ({
  displayTitle,
  artworkRequest,
}: SeasonArtworkPanelProps) => {
  const artwork = useMediaArtwork(artworkRequest)
  const imagePath = artwork?.stillPath ?? artwork?.posterPath
  const imageType = artwork?.stillPath ? "still" : "poster"
  const isArtworkPending = artworkRequest !== undefined && artwork === undefined

  return (
    <div className="mx-auto w-full max-w-72 md:mx-0 md:w-full md:max-w-none">
      <div className="save-list-group-artwork-frame relative overflow-hidden rounded-2xl border border-foreground/15 bg-muted shadow-depth-m">
        <SeasonArtworkImage
          displayTitle={displayTitle}
          imagePath={imagePath}
          imageType={imageType}
          isArtworkPending={isArtworkPending}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-depth-gloss"
        />
      </div>
      {artwork?.identity ? (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Artwork: {artwork.identity.title}
          {artwork.identity.year !== undefined
            ? ` (${artwork.identity.year})`
            : ""}
        </p>
      ) : null}
      {imagePath ? (
        <div className="flex justify-center pt-2">
          <a href={TMDB_SITE_URL} target="_blank" rel="noopener noreferrer">
            <img
              src={TMDB_LOGO_SHORT_SRC}
              alt="The Movie Database (TMDB)"
              className="h-4 w-auto"
            />
          </a>
        </div>
      ) : null}
    </div>
  )
}
