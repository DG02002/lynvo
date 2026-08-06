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
  const isEstimated =
    expirySource === "cache-control" || expirySource === "expires-header"
  const displayLabel = isEstimated ? `Estimated · ${label}` : label

  return (
    <Badge
      variant={isExpired ? "destructive" : "outline"}
      aria-label={displayLabel}
      title={
        isEstimated
          ? "Estimated expiry for this playable link from response caching headers; the saved item itself does not expire."
          : "Expiry for this playable link; the saved item itself does not expire."
      }
      className="tabular-nums"
    >
      {displayLabel}
    </Badge>
  )
}
