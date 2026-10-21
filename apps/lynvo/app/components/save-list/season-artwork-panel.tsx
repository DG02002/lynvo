import type { MediaArtworkRequest } from "~shared/api-contracts"

import { useMediaArtwork } from "~/features/links/media-artwork"
import { TmdbImage } from "~/features/links/tmdb-image"
import { TMDB_LOGO_SHORT_SRC, TMDB_SITE_URL } from "~/lib/constants"

import { GALLERY_GROUP_ARTWORK_SIZES } from "./save-list-layout-constants"
import { SaveListCardSkeleton } from "./save-list-state"

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
        sizes={GALLERY_GROUP_ARTWORK_SIZES}
        alt={`Artwork for ${displayTitle}`}
        width={342}
        height={513}
      />
    )
  }

  if (isArtworkPending) {
    return (
      <SaveListCardSkeleton label={`Loading artwork for ${displayTitle}…`} />
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-muted text-sm text-muted-foreground">
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
  const genres = artwork?.genres
  const contentRating = artwork?.contentRating
  const displayContentRating =
    contentRating?.trim().toUpperCase() === "NR" ? undefined : contentRating

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3.75">
        <div className="mx-auto w-full max-w-60 md:mx-0 md:max-w-none">
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
        </div>
        {genres?.length || displayContentRating ? (
          <div className="mx-auto flex w-full flex-wrap flex-row-reverse items-center justify-center gap-x-2 gap-y-1.5 md:-mx-2 md:w-[calc(100%+1rem)]">
            {displayContentRating ? (
              <span className="inline-flex max-w-full shrink-0 items-center rounded-sm border border-foreground/50 px-1 text-2xs font-medium leading-4 text-foreground">
                {displayContentRating}
              </span>
            ) : null}
            {genres?.length ? (
              <span className="max-w-full shrink-0 text-center text-sm font-normal text-foreground md:text-base md:font-medium">
                {genres.join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {imagePath ? (
        <div className="flex justify-center pt-2 md:pt-4">
          <a href={TMDB_SITE_URL} target="_blank" rel="noopener noreferrer">
            <img
              src={TMDB_LOGO_SHORT_SRC}
              alt="The Movie Database (TMDB)"
              width={123}
              height={16}
              className="h-3 w-auto md:h-4"
            />
          </a>
        </div>
      ) : null}
    </div>
  )
}
