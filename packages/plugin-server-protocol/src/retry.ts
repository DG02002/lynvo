import { sleep } from "./sleep.js"

export interface RetryOptions {
  readonly maxRetries: number
  readonly getDelayMs: (
    cause: unknown,
    retryNumber: number
  ) => number | undefined
  readonly sleep?: (delayMs: number) => Promise<void>
}

export const runWithRetries = async <Value>(
  execute: () => Promise<Value>,
  options: RetryOptions
): Promise<Value> => {
  const sleepForRetry = options.sleep ?? sleep
  let retryNumber = 0

  while (true) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Each attempt must finish before the next retry starts.
      return await execute()
    } catch (cause) {
      if (retryNumber >= options.maxRetries) {
        throw cause
      }

      const nextRetryNumber = retryNumber + 1
      const delayMs = options.getDelayMs(cause, nextRetryNumber)
      if (delayMs === undefined) {
        throw cause
      }

      if (delayMs > 0) {
        // oxlint-disable-next-line no-await-in-loop -- Backoff must finish before the next attempt.
        await sleepForRetry(delayMs)
      }
      retryNumber = nextRetryNumber
    }
  }
}

export const parseRetryAfterMs = (
  value: string | undefined,
  nowMs = Date.now()
): number | undefined => {
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }
  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - nowMs)
}
