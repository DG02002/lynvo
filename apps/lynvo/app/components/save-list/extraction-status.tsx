import { useEffect, useRef, useState, type ReactNode } from "react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "~/components/spinner"
import { MEDIA_LIST_ROW_TITLE_CLASS } from "~/components/save-list/media-list-row"
import type { LinkListItem } from "~/features/links/types"
import {
  EXTRACTION_COMPLETE_DISPLAY_MS,
  EXTRACTION_COMPLETE_FADE_OUT_MS,
  EXTRACTION_COMPLETE_MESSAGES,
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
type ExtractionStatusPhase = "idle" | "waiting" | "complete"

interface UseExtractionStatusLifecycleOptions {
  readonly status: ExtractionStatusInput
  readonly fallbackLabel: string
  readonly shouldRotateMessages: boolean
}

interface ExtractionStatusLifecycle {
  readonly phase: ExtractionStatusPhase
  readonly message: string
  readonly isFadingOut: boolean
  readonly shouldAnimateEntrance: boolean
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

const pickRandomCompletionMessage = () =>
  EXTRACTION_COMPLETE_MESSAGES[
    Math.floor(Math.random() * EXTRACTION_COMPLETE_MESSAGES.length)
  ]

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
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    null
  )
  const [isCompletionFadingOut, setIsCompletionFadingOut] = useState(false)
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
    const shouldCelebrateCompletion =
      wasWaitingRef.current && status !== "failed"
    wasWaitingRef.current = false
    if (!shouldCelebrateCompletion) {
      return
    }

    setCompletionMessage(pickRandomCompletionMessage())
    setIsCompletionFadingOut(false)
    const fadeTimeoutId = window.setTimeout(() => {
      setIsCompletionFadingOut(true)
    }, EXTRACTION_COMPLETE_DISPLAY_MS - EXTRACTION_COMPLETE_FADE_OUT_MS)
    const clearTimeoutId = window.setTimeout(() => {
      setCompletionMessage(null)
      setIsCompletionFadingOut(false)
      setShouldAnimateEntrance(true)
    }, EXTRACTION_COMPLETE_DISPLAY_MS)
    return () => {
      window.clearTimeout(fadeTimeoutId)
      window.clearTimeout(clearTimeoutId)
    }
  }, [isWaiting, status])

  useEffect(() => {
    if (!isWaiting) {
      setMessageIndex(0)
    }
  }, [isWaiting])

  if (isWaiting) {
    if (!shouldRotateMessages || prefersReducedMotion || messageIndex === 0) {
      return {
        phase: "waiting",
        message: fallbackLabel,
        isFadingOut: false,
        shouldAnimateEntrance,
      }
    }
    return {
      phase: "waiting",
      message: EXTRACTION_STATUS_MESSAGES[messageIndex - 1] || fallbackLabel,
      isFadingOut: false,
      shouldAnimateEntrance,
    }
  }

  if (completionMessage) {
    return {
      phase: "complete",
      message: completionMessage,
      isFadingOut: isCompletionFadingOut,
      shouldAnimateEntrance,
    }
  }

  return {
    phase: "idle",
    message: "",
    isFadingOut: false,
    shouldAnimateEntrance,
  }
}

interface ExtractionStatusTextProps {
  readonly phase: ExtractionStatusPhase
  readonly message: string
  readonly isFadingOut?: boolean
  readonly isTitle?: boolean
  readonly titleClassName?: string
}

const ExtractionStatusText = ({
  phase,
  message,
  isFadingOut = false,
  isTitle = false,
  titleClassName,
}: ExtractionStatusTextProps) => {
  if (phase === "complete") {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-primary transition-opacity duration-300 motion-reduce:transition-none",
          isFadingOut ? "opacity-0" : "opacity-100",
          isTitle ? (titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS) : "text-xs"
        )}
        role="status"
      >
        <span className="shimmer min-w-0">{message}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-muted-foreground",
        isTitle ? (titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS) : "text-xs"
      )}
      role={isTitle ? undefined : "status"}
    >
      {!isTitle && <Spinner aria-hidden="true" className="size-3" />}
      <span className={cn("min-w-0", phase === "waiting" && "shimmer")}>
        {message}
      </span>
    </span>
  )
}

interface IsExtractionStatusPresentedOptions {
  readonly isWaiting: boolean
  readonly didFail?: boolean
}

export const useIsExtractionStatusPresented = ({
  isWaiting,
  didFail = false,
}: IsExtractionStatusPresentedOptions): boolean => {
  const lifecycle = useExtractionStatusLifecycle({
    status: isWaiting ? "waiting" : didFail ? "failed" : "idle",
    fallbackLabel: "",
    shouldRotateMessages: false,
  })
  return lifecycle.phase !== "idle"
}

export const SaveExtractionStatus = ({
  item,
  isRefreshing,
  isTitle = false,
  titleClassName,
  children,
}: SaveExtractionStatusProps) => {
  const extractionState = item.extractionStatus?.state
  const extractionError = item.extractionStatus?.error
  const statusLabel = getExtractionStatusLabel(item, isRefreshing)
  const isLoading =
    isRefreshing ||
    extractionState === "queued" ||
    extractionState === "running"
  const status: ExtractionStatusInput = isLoading
    ? "waiting"
    : extractionState === "failed"
      ? "failed"
      : "idle"
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
    if (lifecycle.shouldAnimateEntrance) {
      return (
        <div className="min-w-0 animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
          {children}
        </div>
      )
    }
    return <>{children}</>
  }

  return (
    <ExtractionStatusText
      phase={lifecycle.phase}
      message={lifecycle.message}
      isFadingOut={lifecycle.isFadingOut}
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
    if (lifecycle.shouldAnimateEntrance) {
      return (
        <div className="min-w-0 animate-in fade-in fill-mode-both slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
          {children}
        </div>
      )
    }
    return <>{children}</>
  }

  return (
    <ExtractionStatusText
      phase={lifecycle.phase}
      message={lifecycle.message}
      isFadingOut={lifecycle.isFadingOut}
      isTitle
      titleClassName={titleClassName}
    />
  )
}
