import { runWithRetries } from "@dg02002/lynvo-plugin-server-protocol"

import {
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  UPSTREAM_TIMEOUT_MS,
} from "../constants"
import type { PluginRetryPolicy, SourceRequestContext } from "../plugin-adapter"
import {
  fetchValidatedUpstream,
  UpstreamPolicyError,
} from "../upstream-response"

export const DEFAULT_SOURCE_RETRY_POLICY: PluginRetryPolicy = {
  maxRetries: 2,
  delayMs: 2_000,
}

export interface FetchWithSourceRetriesOptions extends Partial<SourceRequestContext> {
  readonly requestReplaySafe?: boolean | undefined
  readonly now?: (() => number) | undefined
  readonly sleep?: ((delayMs: number) => Promise<void>) | undefined
}

export const isRetryableSourceStatus = (response: Response): boolean =>
  !response.ok &&
  (response.status === 429 || (response.status >= 500 && response.status < 600))

const isRetryableFailure = (cause: unknown): boolean => {
  if (cause instanceof UpstreamPolicyError) {
    return false
  }
  return (
    cause instanceof TypeError ||
    (cause instanceof Error && cause.name === "TimeoutError")
  )
}

const cancelRetryResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel()
  } catch {
    // The retry decision is based on the HTTP status, even if body cleanup fails.
  }
}

/**
 * Retries transport failures (`TypeError` and `TimeoutError`) plus 429/5xx
 * responses, with a fixed delay and no jitter. Bodyless idempotent methods are
 * replayed by default. Other requests need an explicit `requestReplaySafe: true`
 * because their operation and body must both be safe to repeat. Bodies from
 * retryable responses are canceled before the response is returned, including
 * when the retry budget is exhausted; callers must not read those bodies.
 */
export const fetchWithSourceRetries = (
  targetUrl: string | URL,
  requestOptions: RequestInit,
  options: FetchWithSourceRetriesOptions = {}
): Promise<Response> => {
  const retry = options.retry ?? DEFAULT_SOURCE_RETRY_POLICY
  const method = (requestOptions.method ?? "GET").toUpperCase()
  const isIdempotentMethod = [
    "DELETE",
    "GET",
    "HEAD",
    "OPTIONS",
    "PUT",
  ].includes(method)
  const hasBody =
    requestOptions.body !== undefined && requestOptions.body !== null
  const requestReplaySafe =
    options.requestReplaySafe ?? (isIdempotentMethod && !hasBody)
  const maxRetries = requestReplaySafe ? retry.maxRetries : 0
  const startedAtMs = options.startedAtMs ?? Date.now()
  const now = options.now ?? Date.now
  const getRemainingTimeMs = (): number =>
    EXTRACTION_ELAPSED_TIME_LIMIT_MS - (now() - startedAtMs)

  const execute = async (): Promise<Response> => {
    const timeoutMs = Math.floor(
      Math.min(UPSTREAM_TIMEOUT_MS, getRemainingTimeMs())
    )
    if (timeoutMs <= 0) {
      throw new Error("Source extraction exceeded its time limit.")
    }

    const response = await fetchValidatedUpstream(targetUrl, requestOptions, {
      timeoutMs,
    })
    if (isRetryableSourceStatus(response)) {
      await cancelRetryResponseBody(response)
    }
    return response
  }
  const retryOptions: Parameters<typeof runWithRetries<Response>>[1] = {
    maxRetries,
    decide: (outcome) => {
      const retryable =
        outcome._tag === "failure"
          ? isRetryableFailure(outcome.cause)
          : isRetryableSourceStatus(outcome.value)
      if (!retryable || getRemainingTimeMs() <= retry.delayMs) {
        return { retry: false } as const
      }
      return { retry: true, delayMs: retry.delayMs } as const
    },
  }
  if (options.sleep) {
    return runWithRetries(execute, { ...retryOptions, sleep: options.sleep })
  }
  return runWithRetries(execute, retryOptions)
}
