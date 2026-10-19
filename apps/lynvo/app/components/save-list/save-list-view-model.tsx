import {
  AlertCircleIcon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"

import type { LinkItemActions } from "~/features/links/link-item-actions"
import { parseMediaFilename } from "~/features/links/media-artwork"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import { openInPlayerAndMarkOpened } from "~/features/links/open-in-player"
import type { ExtractedLink } from "~/features/links/types"
import { cn } from "~/lib/utils"

import type { ExtractionStatusInput } from "./extraction-status-utils"
import { buildItemAriaLabel } from "./item-aria-label"
import { MEDIA_LIST_HEADER_MENU_CELL_CLASS } from "./media-list-row-constants"
import { SaveListBackButton } from "./save-list-header-controls"
import {
  SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS,
  SEASON_ARTWORK_ASIDE_CLASS,
} from "./save-list-layout-constants"

interface EpisodeSortEntry {
  readonly label: string
  readonly originalIndex: number
}

export const compareByEpisodeNumber = (
  firstEntry: EpisodeSortEntry,
  secondEntry: EpisodeSortEntry,
  parentFolderName?: string
) =>
  (parseMediaFilename(firstEntry.label, parentFolderName).episodeNumber ??
    firstEntry.originalIndex) -
  (parseMediaFilename(secondEntry.label, parentFolderName).episodeNumber ??
    secondEntry.originalIndex)

export interface SaveListItemFallbackIconDescriptor {
  readonly icon: IconSvgElement
  readonly isLoading: boolean
  readonly isExtractionVisual: boolean
}

export const getSaveListItemFallbackIcon = (
  extractionStatus: ExtractionStatusInput,
  hasDirectLink: boolean
): SaveListItemFallbackIconDescriptor => {
  if (extractionStatus === "failed") {
    return {
      icon: AlertCircleIcon,
      isLoading: false,
      isExtractionVisual: true,
    }
  }

  if (extractionStatus !== "idle") {
    return { icon: Folder01Icon, isLoading: true, isExtractionVisual: true }
  }

  return {
    icon: hasDirectLink ? PlayIcon : Folder01Icon,
    isLoading: false,
    isExtractionVisual: false,
  }
}

interface SaveListItemFallbackIconProps {
  readonly descriptor: SaveListItemFallbackIconDescriptor
}

export const SaveListItemFallbackIcon = ({
  descriptor,
}: SaveListItemFallbackIconProps) => {
  const { icon, isLoading } = descriptor
  const renderedIcon = <HugeiconsIcon icon={icon} className="size-6" />

  return isLoading ? (
    <span
      aria-hidden="true"
      className="loading-skeleton-pulse inline-flex text-muted-foreground"
    >
      {renderedIcon}
    </span>
  ) : (
    renderedIcon
  )
}

export const shouldCenterMobileNewBadge = (
  shouldStackIconOnMobile: boolean,
  titleDisplay: "episode" | "filename" | undefined
) => shouldStackIconOnMobile && titleDisplay === "episode"

interface SaveListItemAriaLabelOptions {
  readonly itemTitle: string
  readonly directLink: ExtractedLink | undefined
  readonly isExtractionIncomplete: boolean
  readonly extractionStatusLabel: string
  readonly isOpened: boolean
  readonly isNew: boolean
}

export const getSaveListItemAriaLabel = ({
  itemTitle,
  directLink,
  isExtractionIncomplete,
  extractionStatusLabel,
  isOpened,
  isNew,
}: SaveListItemAriaLabelOptions) => {
  let label: string

  if (isExtractionIncomplete) {
    label = `${extractionStatusLabel} for ${itemTitle}`
  } else if (directLink) {
    label = `Open ${directLink.label || itemTitle}`
  } else {
    label = `View ${itemTitle}`
  }

  return buildItemAriaLabel({ label, isOpened, isNew })
}

interface GallerySaveItemAriaLabelOptions {
  readonly groupTitle: string
  readonly isExtractionVisual: boolean
  readonly didExtractionFail: boolean
  readonly isSingleItem: boolean
  readonly itemTitle: string | undefined
  readonly hasDirectLink: boolean
}

export const getGallerySaveItemAriaLabel = ({
  groupTitle,
  isExtractionVisual,
  didExtractionFail,
  isSingleItem,
  itemTitle,
  hasDirectLink,
}: GallerySaveItemAriaLabelOptions) => {
  if (isExtractionVisual && didExtractionFail) {
    return `Open actions for ${groupTitle}`
  }

  if (isSingleItem && itemTitle !== undefined && !hasDirectLink) {
    return `View ${itemTitle}`
  }

  return `Open ${groupTitle}`
}

interface OpenPlayableAndMarkOpenedOptions {
  readonly actions: LinkItemActions
  readonly itemUrl: string
  readonly playableLink: ExtractedLink
  readonly open: () => Promise<PlaybackHandoffResult>
  readonly markOpenedLink?: ExtractedLink
  readonly shouldPropagateError?: boolean
}

export const openPlayableAndMarkOpened = ({
  actions,
  itemUrl,
  playableLink,
  open,
  markOpenedLink = playableLink,
  shouldPropagateError = false,
}: OpenPlayableAndMarkOpenedOptions): Promise<void> => {
  const target = getMediaNodeTargetOrUndefined(markOpenedLink)
  const operation = openInPlayerAndMarkOpened(open, {
    itemLabel: playableLink.label,
    markOpened: () => {
      if (target !== undefined) {
        actions.markOpened(itemUrl, target)
      }
    },
  })

  return shouldPropagateError ? operation : operation.catch(console.error)
}

interface ImmersiveBrowserHeaderProps {
  readonly onNavigateBack: () => void
  readonly title: ReactNode
  readonly center?: ReactNode
  readonly menu: ReactNode
  readonly menuCellClassName?: string
}

export const ImmersiveBrowserHeader = ({
  onNavigateBack,
  title,
  center,
  menu,
  menuCellClassName = MEDIA_LIST_HEADER_MENU_CELL_CLASS,
}: ImmersiveBrowserHeaderProps) => (
  <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
    <SaveListBackButton onNavigateBack={onNavigateBack} />
    {title}
    {center}
    <div className={menuCellClassName}>{menu}</div>
  </header>
)

interface SeasonArtworkAsideProps {
  readonly as?: "aside" | "div"
  readonly className?: string
  readonly children: ReactNode
}

export const SeasonArtworkAside = ({
  as = "aside",
  className,
  children,
}: SeasonArtworkAsideProps) => {
  const asideClassName = cn(SEASON_ARTWORK_ASIDE_CLASS, className)
  return as === "div" ? (
    <div className={asideClassName}>{children}</div>
  ) : (
    <aside className={asideClassName}>{children}</aside>
  )
}
