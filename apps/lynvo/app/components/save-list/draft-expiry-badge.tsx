import { Badge } from "~/components/ui/badge"
import { formatDraftExpiry } from "~/features/links/format-draft-expiry"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"

interface DraftExpiryBadgeProps {
  expiresAt: number
}

export const DraftExpiryBadge = ({ expiresAt }: DraftExpiryBadgeProps) => {
  useMinuteTimeBucket()
  const label = formatDraftExpiry(expiresAt)

  return (
    <Badge
      variant="outline"
      aria-label={label}
      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      {label}
    </Badge>
  )
}
