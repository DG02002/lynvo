interface RetryOptions {
  readonly maxRetries: number
  readonly getDelayMs: (
    cause: unknown,
    retryNumber: number
  ) => number | undefined
}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs))

export const runWithRetries = async <Value>(
  execute: () => Promise<Value>,
  options: RetryOptions,
  retryNumber = 0
): Promise<Value> => {
  try {
    return await execute()
  } catch (cause) {
    if (retryNumber >= options.maxRetries) {
      throw cause
    }

    const delayMs = options.getDelayMs(cause, retryNumber + 1)
    if (delayMs === undefined) {
      throw cause
    }

    if (delayMs > 0) {
      await wait(delayMs)
    }
    return await runWithRetries(execute, options, retryNumber + 1)
  }
}
