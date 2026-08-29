import type { LinkListItem } from "~/features/links/types"

export type ExtractionStatusInput = "idle" | "waiting" | "failed"

export const getExtractionStatusInput = (
  item: LinkListItem | undefined,
  isRefreshing: boolean
): ExtractionStatusInput => {
  const extractionState = item?.extractionStatus?.state
  if (
    isRefreshing ||
    extractionState === "queued" ||
    extractionState === "running"
  ) {
    return "waiting"
  }
  return extractionState === "failed" ? "failed" : "idle"
}

export const getExtractionStatusLabel = (
  item: LinkListItem,
  isRefreshing: boolean
): string => {
  if (isRefreshing || item.extractionStatus?.state === "running") {
    return "Loading links…"
  }
  switch (item.extractionStatus?.state) {
    case "queued":
      return "Waiting to load…"
    case "failed":
      return item.extractionStatus.error || "Unable to load links"
    default:
      return ""
  }
}
