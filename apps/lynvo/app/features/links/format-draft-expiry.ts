const MINUTE_MS = 60 * 1000
const HOUR_IN_MINUTES = 60
const DAY_IN_MINUTES = 24 * HOUR_IN_MINUTES

const formatUnit = (value: number, singular: string) =>
  `${value} ${singular}${value === 1 ? "" : "s"}`

export const formatDraftExpiry = (
  expiresAt: number,
  now = Date.now()
): string => {
  const remainingMinutes = Math.max(0, Math.ceil((expiresAt - now) / MINUTE_MS))

  if (remainingMinutes === 0) {
    return "Expiring now"
  }

  const days = Math.floor(remainingMinutes / DAY_IN_MINUTES)
  const hours = Math.floor(
    (remainingMinutes % DAY_IN_MINUTES) / HOUR_IN_MINUTES
  )
  const minutes = remainingMinutes % HOUR_IN_MINUTES
  const parts: string[] = []

  if (days > 0) {
    parts.push(formatUnit(days, "day"))
  }
  if (hours > 0) {
    parts.push(formatUnit(hours, "hour"))
  }
  if (minutes > 0 && parts.length < 2) {
    parts.push(formatUnit(minutes, "min"))
  }

  return `Expiring in ${parts.join(" ")}`
}
