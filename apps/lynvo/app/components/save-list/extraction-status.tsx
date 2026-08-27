import { useEffect, useRef, useState, type ReactNode } from "react"
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
  readonly titleClassName?: string
  readonly children?: ReactNode
}

interface ExtractionWaitStatusProps {
  readonly isWaiting: boolean
  readonly didFail?: boolean
  readonly fallbackLabel?: string
  readonly titleClassName?: string
  readonly children: ReactNode
}

type ExtractionStatusInput = "idle" | "waiting" | "failed"
type ExtractionStatusPhase = "idle" | "waiting"

interface UseExtractionStatusLifecycleOptions {
  readonly status: ExtractionStatusInput
  readonly fallbackLabel: string
  readonly shouldRotateMessages: boolean
}

interface ExtractionStatusLifecycle {
  readonly phase: ExtractionStatusPhase
  readonly message: string
  readonly shouldAnimateEntrance: boolean
}

interface ExtractionStatusTextProps {
  readonly message: string
  readonly isTitle?: boolean
  readonly titleClassName?: string
}

const PREFERS_REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)"

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

const usePrefersReducedMotion = (): boolean => {
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

  return prefersReducedMotion
}

const useExtractionStatusLifecycle = ({
  status,
  fallbackLabel,
  shouldRotateMessages,
}: UseExtractionStatusLifecycleOptions): ExtractionStatusLifecycle => {
  const isWaiting = status === "waiting"
  const [messageIndex, setMessageIndex] = useState(0)
  const [shouldAnimateEntrance, setShouldAnimateEntrance] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const wasWaitingRef = useRef(false)

  useEffect(() => {
    if (!isWaiting || prefersReducedMotion) {
      return
    }

    const intervalId = window.setInterval(() => {
      setMessageIndex(
        (currentIndex) =>
          (currentIndex + 1) % (EXTRACTION_STATUS_MESSAGES.length + 1)
      )
    }, EXTRACTION_STATUS_ROTATION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [isWaiting, prefersReducedMotion])

  useEffect(() => {
    if (isWaiting) {
      wasWaitingRef.current = true
      setShouldAnimateEntrance(false)
      return
    }
    const didWaitEnd = wasWaitingRef.current && status !== "failed"
    wasWaitingRef.current = false
    if (didWaitEnd) {
      setShouldAnimateEntrance(true)
    }
  }, [isWaiting, status])

  useEffect(() => {
    if (!isWaiting) {
      setMessageIndex(0)
    }
  }, [isWaiting])

  if (isWaiting) {
    if (!shouldRotateMessages || prefersReducedMotion || messageIndex === 0) {
      return { phase: "waiting", message: fallbackLabel, shouldAnimateEntrance }
    }
    return {
      phase: "waiting",
      message: EXTRACTION_STATUS_MESSAGES[messageIndex - 1] || fallbackLabel,
      shouldAnimateEntrance,
    }
  }

  return { phase: "idle", message: "", shouldAnimateEntrance }
}

const ExtractionStatusText = ({
  message,
  isTitle = false,
  titleClassName,
}: ExtractionStatusTextProps) => (
  <span
    className={cn(
      "flex min-w-0 items-center gap-1.5 text-muted-foreground",
      isTitle ? (titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS) : "text-xs"
    )}
    role={isTitle ? undefined : "status"}
  >
    {!isTitle && <Spinner aria-hidden="true" className="size-3" />}
    <span
      key={message}
      className="animate-in fade-in duration-500 motion-reduce:animate-none min-w-0"
    >
      <span className="shimmer">{message}</span>
    </span>
  </span>
)

const renderExtractionStatusChildren = (
  children: ReactNode,
  shouldAnimateEntrance: boolean
) => {
  if (shouldAnimateEntrance) {
    return (
      <div className="min-w-0 animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        {children}
      </div>
    )
  }
  return <>{children}</>
}

export const SaveExtractionStatus = ({
  item,
  isRefreshing,
  isTitle = false,
  titleClassName,
  children,
}: SaveExtractionStatusProps) => {
  const extractionError = item.extractionStatus?.error
  const statusLabel = getExtractionStatusLabel(item, isRefreshing)
  const status = getExtractionStatusInput(item, isRefreshing)
  const lifecycle = useExtractionStatusLifecycle({
    status,
    fallbackLabel: statusLabel,
    shouldRotateMessages: Boolean(isTitle),
  })

  if (status === "failed") {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-destructive",
          isTitle ? (titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS) : "text-xs"
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

  if (lifecycle.phase === "idle") {
    if (children === undefined) {
      return null
    }
    return renderExtractionStatusChildren(
      children,
      lifecycle.shouldAnimateEntrance
    )
  }

  return (
    <ExtractionStatusText
      message={lifecycle.message}
      isTitle={isTitle}
      titleClassName={titleClassName}
    />
  )
}

export const ExtractionWaitStatus = ({
  isWaiting,
  didFail = false,
  fallbackLabel = "Loading links…",
  titleClassName,
  children,
}: ExtractionWaitStatusProps) => {
  const lifecycle = useExtractionStatusLifecycle({
    status: isWaiting ? "waiting" : didFail ? "failed" : "idle",
    fallbackLabel,
    shouldRotateMessages: true,
  })

  if (lifecycle.phase === "idle") {
    return renderExtractionStatusChildren(
      children,
      lifecycle.shouldAnimateEntrance
    )
  }

  return (
    <ExtractionStatusText
      message={lifecycle.message}
      isTitle
      titleClassName={titleClassName}
    />
  )
}
