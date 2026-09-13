export interface TestRateLimiterCall {
  readonly key: string
  readonly input: string
  readonly init: RequestInit | undefined
  readonly attempt: number
}

export const createTestRateLimiter = (
  handler: (call: TestRateLimiterCall) => Response | Promise<Response>
) => {
  const calls: TestRateLimiterCall[] = []
  const attemptsByKey = new Map<string, number>()
  // SAFETY: This namespace implements the getByName and fetch methods exercised by Worker tests.
  const namespace = {
    getByName(key: string) {
      return {
        fetch: async (input: string, init?: RequestInit) => {
          const attempt = attemptsByKey.get(key) ?? 0
          attemptsByKey.set(key, attempt + 1)
          const call = { key, input, init, attempt }
          calls.push(call)
          return handler(call)
        },
      }
    },
  } as DurableObjectNamespace
  return { calls, namespace }
}
