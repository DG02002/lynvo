import type { LinkListItem } from "~/features/links/types"

export type ExtractionStatusInput = "idle" | "waiting" | "failed"

export interface ExtractionStatusTitleSpec {
  readonly status: ExtractionStatusInput
  readonly fallbackLabel?: string
  readonly error?: string
}

export const getItemExtractionState = (
  item: LinkListItem | undefined,
  isRefreshing: boolean
) => (isRefreshing ? "running" : (item?.extractionStatus?.state ?? "complete"))

export const getExtractionWaitStatusInput = (
  isWaiting: boolean,
  didFail: boolean
): ExtractionStatusInput => {
  if (isWaiting) {
    return "waiting"
  }
  return didFail ? "failed" : "idle"
}

export const getExtractionStatusInputForState = (
  extractionState: ReturnType<typeof getItemExtractionState>
): ExtractionStatusInput =>
  getExtractionWaitStatusInput(
    extractionState === "queued" || extractionState === "running",
    extractionState === "failed"
  )

export const getExtractionStatusInput = (
  item: LinkListItem | undefined,
  isRefreshing: boolean
): ExtractionStatusInput =>
  getExtractionStatusInputForState(getItemExtractionState(item, isRefreshing))

export const getExtractionStatusTitleSpec = (
  item: LinkListItem | undefined,
  isRefreshing: boolean
): ExtractionStatusTitleSpec => ({
  status: getExtractionStatusInput(item, isRefreshing),
  fallbackLabel: item
    ? getExtractionStatusLabel(item, isRefreshing)
    : undefined,
  error: item?.extractionStatus?.error,
})

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
