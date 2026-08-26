import { useEffect, useState } from "react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "~/components/spinner"
import { MEDIA_LIST_ROW_TITLE_CLASS } from "~/components/save-list/media-list-row"
import type { LinkListItem } from "~/features/links/types"
import {
  EXTRACTION_STATUS_MESSAGES,
  EXTRACTION_STATUS_ROTATION_INTERVAL_MS,
} from "~/lib/constants"
import { cn } from "~/lib/utils"

interface SaveExtractionStatusProps {
  readonly item: LinkListItem
  readonly isRefreshing: boolean
  readonly isTitle?: boolean
}

interface UseRotatingExtractionStatusProps {
  readonly fallbackLabel: string
  readonly isActive: boolean
}

const PREFERS_REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)"

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

const useRotatingExtractionStatus = ({
  fallbackLabel,
  isActive,
}: UseRotatingExtractionStatusProps) => {
  const [messageIndex, setMessageIndex] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      PREFERS_REDUCED_MOTION_MEDIA_QUERY
    )
    const updateReducedMotion = () => {
      setPrefersReducedMotion(reducedMotionQuery.matches)
    }

    updateReducedMotion()
    reducedMotionQuery.addEventListener?.("change", updateReducedMotion)
    return () => {
      reducedMotionQuery.removeEventListener?.("change", updateReducedMotion)
    }
  }, [])

  useEffect(() => {
    if (!isActive || prefersReducedMotion) {
      return
    }

    const intervalId = window.setInterval(() => {
      setMessageIndex(
        (currentIndex) =>
          (currentIndex + 1) % (EXTRACTION_STATUS_MESSAGES.length + 1)
      )
    }, EXTRACTION_STATUS_ROTATION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [isActive, prefersReducedMotion])

  useEffect(() => {
    if (!isActive) {
      setMessageIndex(0)
    }
  }, [isActive])

  if (!isActive || prefersReducedMotion || messageIndex === 0) {
    return fallbackLabel
  }

  return EXTRACTION_STATUS_MESSAGES[messageIndex - 1] || fallbackLabel
}

export const SaveExtractionStatus = ({
  item,
  isRefreshing,
  isTitle = false,
}: SaveExtractionStatusProps) => {
  const extractionState = item.extractionStatus?.state
  const extractionError = item.extractionStatus?.error
  const statusLabel = getExtractionStatusLabel(item, isRefreshing)
  const isLoading =
    isRefreshing ||
    extractionState === "queued" ||
    extractionState === "running"
  const statusMessage = useRotatingExtractionStatus({
    fallbackLabel: statusLabel,
    isActive: isTitle && isLoading,
  })

  if (!extractionState || extractionState === "complete") {
    return null
  }

  if (isLoading) {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-muted-foreground",
          isTitle ? MEDIA_LIST_ROW_TITLE_CLASS : "text-xs"
        )}
        role={isTitle ? undefined : "status"}
      >
        {!isTitle && <Spinner aria-hidden="true" className="size-3" />}
        <span className="shimmer min-w-0">
          {isTitle ? statusMessage : statusLabel}
        </span>
      </span>
    )
  }

  if (extractionState === "failed") {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-destructive",
          isTitle ? MEDIA_LIST_ROW_TITLE_CLASS : "text-xs"
        )}
        role="alert"
        title={extractionError || "Unable to load links"}
      >
        {!isTitle && (
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 truncate">
          {extractionError || getExtractionStatusLabel(item, false)}
        </span>
      </span>
    )
  }

  return null
}
