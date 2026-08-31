import { useEffect, useState, type ReactNode } from "react"
import { MEDIA_LIST_ROW_TITLE_CLASS } from "./media-list-row-constants"
import type { ExtractionStatusInput } from "./extraction-status-utils"
import {
  EXTRACTION_STATUS_MESSAGES,
  EXTRACTION_STATUS_ROTATION_INTERVAL_MS,
} from "~/lib/constants"
import { cn } from "~/lib/utils"

interface ExtractionStatusTitleProps {
  readonly status: ExtractionStatusInput
  readonly fallbackLabel?: string
  readonly error?: string
  readonly titleClassName?: string
  readonly children: ReactNode
}

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
  readonly titleClassName?: string
}

const DEFAULT_FALLBACK_LABEL = "Loading links…"
const PREFERS_REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)"

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
  const [lifecycleState, setLifecycleState] = useState({
    observedStatus: status,
    messageIndex: 0,
    shouldAnimateEntrance: false,
  })
  const prefersReducedMotion = usePrefersReducedMotion()

  if (lifecycleState.observedStatus !== status) {
    setLifecycleState({
      observedStatus: status,
      messageIndex: 0,
      shouldAnimateEntrance:
        lifecycleState.observedStatus === "waiting" && status === "idle",
    })
  }

  useEffect(() => {
    if (!isWaiting || prefersReducedMotion) {
      return
    }

    const intervalId = window.setInterval(() => {
      setLifecycleState((currentState) => ({
        ...currentState,
        messageIndex:
          (currentState.messageIndex + 1) %
          (EXTRACTION_STATUS_MESSAGES.length + 1),
      }))
    }, EXTRACTION_STATUS_ROTATION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [isWaiting, prefersReducedMotion])

  if (isWaiting) {
    if (
      !shouldRotateMessages ||
      prefersReducedMotion ||
      lifecycleState.messageIndex === 0
    ) {
      return {
        phase: "waiting",
        message: fallbackLabel,
        shouldAnimateEntrance: lifecycleState.shouldAnimateEntrance,
      }
    }
    return {
      phase: "waiting",
      message:
        EXTRACTION_STATUS_MESSAGES[lifecycleState.messageIndex - 1] ||
        fallbackLabel,
      shouldAnimateEntrance: lifecycleState.shouldAnimateEntrance,
    }
  }

  return {
    phase: "idle",
    message: "",
    shouldAnimateEntrance: lifecycleState.shouldAnimateEntrance,
  }
}

const ExtractionStatusText = ({
  message,
  titleClassName,
}: ExtractionStatusTextProps) => (
  <span
    className={cn(
      "flex min-w-0 items-center gap-1.5 text-muted-foreground",
      titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS
    )}
  >
    <span
      key={message}
      className="animate-[enter_500ms_ease] fade-in motion-reduce:animate-none min-w-0"
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
      <div className="min-w-0 animate-[enter_300ms_ease_both] fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
        {children}
      </div>
    )
  }
  return <>{children}</>
}

export const ExtractionStatusTitle = ({
  status,
  fallbackLabel = DEFAULT_FALLBACK_LABEL,
  error,
  titleClassName,
  children,
}: ExtractionStatusTitleProps) => {
  const lifecycle = useExtractionStatusLifecycle({
    status,
    fallbackLabel,
    shouldRotateMessages: true,
  })

  if (status === "failed") {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-destructive",
          titleClassName ?? MEDIA_LIST_ROW_TITLE_CLASS
        )}
        role="alert"
        title={error || "Unable to load links"}
      >
        <span className="min-w-0 truncate">{error || fallbackLabel}</span>
      </span>
    )
  }

  if (lifecycle.phase === "idle") {
    return renderExtractionStatusChildren(
      children,
      lifecycle.shouldAnimateEntrance
    )
  }

  return (
    <ExtractionStatusText
      message={lifecycle.message}
      titleClassName={titleClassName}
    />
  )
}
