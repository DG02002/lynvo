export const parseRetryAfterMs = (
  value: string | undefined,
  nowMs = Date.now()
): number | undefined => {
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds) * 1000
  }
  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - nowMs)
}
