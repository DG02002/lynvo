const PLAYABLE_EXPIRY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export const formatPlayableExpiry = (expiry: number): string =>
  `Expires ${PLAYABLE_EXPIRY_DATE_FORMATTER.format(new Date(expiry))}`
