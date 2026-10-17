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
}

export const PlayableExpiryBadge = ({
  expiresAt,
}: PlayableExpiryBadgeProps) => {
  const currentTimeMs = useMinuteTimeBucket()

  const label = formatPlayableExpiry(expiresAt)
  const isExpired = expiresAt <= currentTimeMs
  // Every expiry Lynvo records is an estimate from the source, not a verified
  // deadline: hosts routinely keep serving past a signed URL's nominal
  // expiry, so the badge never claims the link is dead.
  const displayLabel = formatPlayableValidity(expiresAt, currentTimeMs, true)
  const accessibleLabel = `Estimated: ${label}`

  return (
    <span
      aria-label={accessibleLabel}
      title="Estimated expiry for this playable link from the source. The link may still work after it — refresh the saved link if playback fails. The saved item itself does not expire."
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
