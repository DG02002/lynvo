import { sleep } from "@dg02002/lynvo-plugin-server-protocol"

interface RetryOptions {
  readonly maxRetries: number
  readonly getDelayMs: (
    cause: unknown,
    retryNumber: number
  ) => number | undefined
}

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
      await sleep(delayMs)
    }
    return await runWithRetries(execute, options, retryNumber + 1)
  }
}
