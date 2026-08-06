import type { ExpirySource } from "@dg02002/lynvo-plugin-server-protocol"
import { Badge } from "~/components/ui/badge"
import { formatPlayableExpiry } from "~/features/links/format-playable-expiry"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"

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
  const isEstimated = expirySource === "cache-control"
  const displayLabel = isEstimated ? `Estimated · ${label}` : label

  return (
    <Badge
      variant={isExpired ? "destructive" : "outline"}
      aria-label={displayLabel}
      title={
        isEstimated
          ? "Estimated from Cache-Control; the media server may expire it sooner."
          : undefined
      }
      className="tabular-nums"
    >
      {displayLabel}
    </Badge>
  )
}
