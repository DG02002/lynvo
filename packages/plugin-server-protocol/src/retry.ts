import { sleep } from "./sleep.js"

type RetryOutcome<Value> =
  | { readonly _tag: "success"; readonly value: Value }
  | { readonly _tag: "failure"; readonly cause: unknown }

type RetryDecision =
  | { readonly retry: false }
  | { readonly retry: true; readonly delayMs: number }

interface RetryOptions<Value> {
  readonly maxRetries: number
  readonly decide: (
    outcome: RetryOutcome<Value>,
    retryNumber: number
  ) => RetryDecision
  readonly sleep?: (delayMs: number) => Promise<void>
}

export const runWithRetries = async <Value>(
  execute: () => Promise<Value>,
  options: RetryOptions<Value>
): Promise<Value> => {
  const sleepForRetry = options.sleep ?? sleep
  const waitForRetry = async (
    decision: Extract<RetryDecision, { readonly retry: true }>
  ): Promise<void> => {
    if (decision.delayMs > 0) {
      await sleepForRetry(decision.delayMs)
    }
  }
  const shouldRetry = async (
    outcome: RetryOutcome<Value>,
    retryNumber: number
  ): Promise<boolean> => {
    const decision = options.decide(outcome, retryNumber)
    if (!decision.retry) {
      return false
    }
    await waitForRetry(decision)
    return true
  }
  let retryNumber = 0

  while (true) {
    let value: Value
    try {
      // oxlint-disable-next-line no-await-in-loop -- Each attempt must finish before the next retry starts.
      value = await execute()
    } catch (cause) {
      if (retryNumber >= options.maxRetries) {
        throw cause
      }
      // oxlint-disable-next-line no-await-in-loop -- Backoff must finish before the next attempt.
      if (!(await shouldRetry({ _tag: "failure", cause }, retryNumber + 1))) {
        throw cause
      }
      retryNumber += 1
      continue
    }
    if (retryNumber >= options.maxRetries) {
      return value
    }
    // oxlint-disable-next-line no-await-in-loop -- Backoff must finish before the next attempt.
    if (!(await shouldRetry({ _tag: "success", value }, retryNumber + 1))) {
      return value
    }
    retryNumber += 1
  }
}
