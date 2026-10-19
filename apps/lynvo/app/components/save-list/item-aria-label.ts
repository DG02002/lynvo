import type { ExtractedLink } from "~/features/links/types"

interface ItemAriaLabelOptions {
  readonly label: string | undefined
  readonly isOpened: boolean
  readonly isNew?: boolean
}

export const buildItemAriaLabel = ({
  label,
  isOpened,
  isNew = false,
}: ItemAriaLabelOptions) =>
  label
    ? [label, isNew ? "new" : undefined, isOpened ? "opened" : undefined]
        .filter(Boolean)
        .join(", ")
    : undefined

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
