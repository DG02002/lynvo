import type { LinkExtractionStatus, LinkListItem } from "~/features/links/types"

export type ExtractionStatusInput = "idle" | "waiting" | "failed"

export interface ExtractionStatusTitleSpec {
  readonly status: ExtractionStatusInput
  readonly fallbackLabel?: string
  readonly error?: string
}

export type LinkExtractionState = LinkExtractionStatus["state"]

export const getItemExtractionState = (
  item: LinkListItem | undefined,
  isRefreshing: boolean
): LinkExtractionState => {
  const extractionState = item?.extractionStatus?.state ?? "complete"
  return isRefreshing && extractionState !== "queued"
    ? "running"
    : extractionState
}

export const isPendingExtractionState = (
  extractionState: LinkExtractionState
): boolean => extractionState === "queued" || extractionState === "running"

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
  extractionState: LinkExtractionState
): ExtractionStatusInput =>
  getExtractionWaitStatusInput(
    isPendingExtractionState(extractionState),
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
): ExtractionStatusTitleSpec => {
  const extractionState = getItemExtractionState(item, isRefreshing)
  return {
    status: getExtractionStatusInputForState(extractionState),
    fallbackLabel: item
      ? getExtractionStatusLabel(extractionState, item.extractionStatus?.error)
      : undefined,
    error: item?.extractionStatus?.error,
  }
}

export const getExtractionStatusLabel = (
  extractionState: LinkExtractionState,
  error?: string
): string => {
  switch (extractionState) {
    case "running":
      return "Loading links…"
    case "queued":
      return "Waiting to load…"
    case "failed":
      return error || "Unable to load links"
    default:
      return ""
  }
}
