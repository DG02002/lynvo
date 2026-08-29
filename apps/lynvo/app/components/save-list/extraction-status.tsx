import { useEffect, useState, type ReactNode } from "react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "~/components/spinner"
import { MEDIA_LIST_ROW_TITLE_CLASS } from "./media-list-row-constants"
import {
  getExtractionStatusInput,
  getExtractionStatusLabel,
  type ExtractionStatusInput,
} from "./extraction-status-utils"
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

const getExtractionWaitStatusInput = (
  isWaiting: boolean,
  didFail: boolean
): ExtractionStatusInput => {
  if (isWaiting) {
    return "waiting"
  }
  if (didFail) {
    return "failed"
  }
  return "idle"
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
    status: getExtractionWaitStatusInput(isWaiting, didFail),
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
