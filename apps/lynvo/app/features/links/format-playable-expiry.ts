const MINUTE_MS = 60 * 1000
const HOUR_IN_MINUTES = 60
const DAY_IN_MINUTES = 24 * HOUR_IN_MINUTES
const RELATIVE_EXPIRY_WINDOW_MINUTES = 7 * DAY_IN_MINUTES

const PLAYABLE_EXPIRY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const formatUnit = (value: number, singular: string) =>
  `${value} ${singular}${value === 1 ? "" : "s"}`

export const formatPlayableExpiry = (
  expiry: number,
  now = Date.now()
): string => {
  const remainingMinutes = Math.ceil((expiry - now) / MINUTE_MS)
  if (remainingMinutes <= 0) {
    return "Expired"
  }

  if (remainingMinutes > RELATIVE_EXPIRY_WINDOW_MINUTES) {
    return `Expires ${PLAYABLE_EXPIRY_DATE_FORMATTER.format(new Date(expiry))}`
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

  return `Expires in ${parts.join(" ")}`
}
