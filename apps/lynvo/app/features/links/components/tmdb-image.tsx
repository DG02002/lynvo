import { useEffect, useRef, useState } from "react"
import { Skeleton } from "~/components/ui/skeleton"
import {
  TMDB_IMAGE_BASE_URL,
  TMDB_IMAGE_CARD_BASE_URL,
  TMDB_IMAGE_CARD_PREVIEW_BASE_URL,
  TMDB_IMAGE_DETAIL_BASE_URL,
  TMDB_IMAGE_DETAIL_PREVIEW_BASE_URL,
  TMDB_IMAGE_WIDE_CARD_BASE_URL,
  TMDB_IMAGE_WIDE_CARD_PREVIEW_BASE_URL,
  TMDB_POSTER_SRC_WIDTHS_PX,
  TMDB_STILL_SRC_WIDTHS_PX,
} from "~/lib/constants"
import { cn } from "~/lib/utils"

interface TmdbImageProps {
  readonly path: string | undefined
  readonly variant: "card" | "detail" | "wide-card"
  readonly alt: string
  readonly isLazy?: boolean
  readonly className?: string
  readonly width?: number
  readonly height?: number
  readonly imageType?: "poster" | "still"
  readonly sizes?: string
}

interface TmdbImageBaseUrlPair {
  readonly full: string
  readonly preview: string
}

const getTmdbImageBaseUrlPair = (
  variant: TmdbImageProps["variant"]
): TmdbImageBaseUrlPair => {
  if (variant === "card") {
    return {
      full: TMDB_IMAGE_CARD_BASE_URL,
      preview: TMDB_IMAGE_CARD_PREVIEW_BASE_URL,
    }
  }
  if (variant === "wide-card") {
    return {
      full: TMDB_IMAGE_WIDE_CARD_BASE_URL,
      preview: TMDB_IMAGE_WIDE_CARD_PREVIEW_BASE_URL,
    }
  }
  return {
    full: TMDB_IMAGE_DETAIL_BASE_URL,
    preview: TMDB_IMAGE_DETAIL_PREVIEW_BASE_URL,
  }
}

const hasImageLoaded = (element: HTMLImageElement | null): boolean =>
  Boolean(element?.complete && element.naturalWidth > 0)

const getTmdbImageSrcSet = (
  path: string,
  imageType: "poster" | "still"
): string => {
  const srcWidths =
    imageType === "still" ? TMDB_STILL_SRC_WIDTHS_PX : TMDB_POSTER_SRC_WIDTHS_PX
  return srcWidths
    .map(
      (srcWidth) => `${TMDB_IMAGE_BASE_URL}/w${srcWidth}${path} ${srcWidth}w`
    )
    .join(", ")
}

const getTmdbFullUrl = (
  path: string | undefined,
  isRemotePath: boolean,
  fullBaseUrl: string
) => {
  if (!path) {
    return undefined
  }

  if (isRemotePath) {
    return path
  }

  return `${fullBaseUrl}${path}`
}

const TmdbImageContent = ({
  path,
  variant,
  alt,
  isLazy = true,
  className,
  width,
  height,
  imageType = "poster",
  sizes,
}: TmdbImageProps) => {
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false)
  const [isFullLoaded, setIsFullLoaded] = useState(false)
  const previewImageRef = useRef<HTMLImageElement | null>(null)
  const fullImageRef = useRef<HTMLImageElement | null>(null)

  const isRemotePath = path?.startsWith("http") ?? false
  const baseUrlPair = getTmdbImageBaseUrlPair(variant)
  const fullUrl = getTmdbFullUrl(path, isRemotePath, baseUrlPair.full)
  const previewUrl =
    !path || isRemotePath ? undefined : `${baseUrlPair.preview}${path}`
  const fullSrcSet =
    path && !isRemotePath ? getTmdbImageSrcSet(path, imageType) : undefined

  useEffect(() => {
    if (hasImageLoaded(previewImageRef.current)) {
      setIsPreviewLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (hasImageLoaded(fullImageRef.current)) {
      setIsFullLoaded(true)
    }
  }, [])

  if (!path) {
    return null
  }

  const shouldShowSkeleton = !isFullLoaded && (!previewUrl || !isPreviewLoaded)

  return (
    <>
      {shouldShowSkeleton && (
        <Skeleton className="absolute inset-0 size-full" />
      )}
      {previewUrl && !isFullLoaded && (
        <img
          ref={previewImageRef}
          src={previewUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full scale-110 object-cover blur-md transition-opacity duration-300 motion-reduce:blur-none motion-reduce:transition-none",
            isPreviewLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          loading={isLazy ? "lazy" : "eager"}
          decoding="async"
          onLoad={() => setIsPreviewLoaded(true)}
        />
      )}
      <img
        ref={fullImageRef}
        src={fullUrl}
        srcSet={fullSrcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
          isFullLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        loading={isLazy ? "lazy" : "eager"}
        decoding="async"
        onLoad={() => setIsFullLoaded(true)}
      />
    </>
  )
}

export const TmdbImage = (props: TmdbImageProps) => {
  const imageIdentity = `${props.variant}:${props.imageType ?? "poster"}:${props.path ?? ""}`
  return <TmdbImageContent key={imageIdentity} {...props} />
}
