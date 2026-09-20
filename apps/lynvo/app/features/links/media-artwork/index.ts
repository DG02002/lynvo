// Keep the media classification and season identity globals available to
// feature modules that still use those internal UI-only types.
import "./media-artwork-types"

export type { GalleryGroup } from "./media-artwork-types"
export {
  getGalleryGroups,
  getGalleryGroupSections,
  getGalleryItemLabel,
  getSharedSeasonIdentity,
} from "./gallery-grouping"
export {
  getEpisodeListingLabels,
  getMediaArtworkRequest,
  getMediaDisplayTitle,
  getMediaEpisodeDisplayTitle,
  hasEpisodeMarker,
  isEpisodeOnlyListing,
} from "./media-artwork-identity"
export { parseMediaFilename } from "./media-filename-parser"
export { searchMediaArtwork } from "./media-artwork-client"
export { useMediaArtwork } from "./use-media-artwork"
