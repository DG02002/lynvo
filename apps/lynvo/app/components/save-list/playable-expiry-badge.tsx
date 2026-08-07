import type { ExpirySource } from "@dg02002/lynvo-plugin-server-protocol"
import { Clock04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  formatPlayableExpiry,
  formatPlayableValidity,
} from "~/features/links/format-playable-expiry"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"
import { cn } from "~/lib/utils"

interface PlayableExpiryBadgeProps {
  expiresAt: number
  expirySource?: ExpirySource
}

export const PlayableExpiryBadge = ({
  expiresAt,
  expirySource,
}: PlayableExpiryBadgeProps) => {
  useMinuteTimeBucket()

  const label = formatPlayableExpiry(expiresAt)
  const isExpired = expiresAt <= Date.now()
  const isEstimated =
    expirySource === "cache-control" || expirySource === "expires-header"
  const displayLabel = formatPlayableValidity(
    expiresAt,
    Date.now(),
    isEstimated
  )
  const accessibleLabel = isEstimated ? `Estimated: ${label}` : label

  return (
    <span
      aria-label={accessibleLabel}
      title={
        isEstimated
          ? "Estimated expiry for this playable link from response caching headers; the saved item itself does not expire."
          : "Expiry for this playable link; the saved item itself does not expire."
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1 tabular-nums",
        isExpired && "text-destructive"
      )}
    >
      {!isExpired && (
        <HugeiconsIcon
          icon={Clock04Icon}
          className="size-3.5"
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  )
}
