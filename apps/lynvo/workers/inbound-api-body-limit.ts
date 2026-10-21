import type { MiddlewareHandler } from "hono"

import {
  INBOUND_API_BODY_READ_TIMEOUT_MS,
  MAX_INBOUND_API_BODY_BYTES,
} from "./constants"
import { requestApiError } from "./request-api-error"
import type { RequestLoggingEnvironment } from "./request-logging"

const requestDeclaresOversizedApiBody = (request: Request): boolean => {
  const contentLength = request.headers.get("content-length")
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return false
  }
  const declaredLength = Number(contentLength)
  return (
    !Number.isSafeInteger(declaredLength) ||
    declaredLength > MAX_INBOUND_API_BODY_BYTES
  )
}

const API_BODY_LIMIT_EXCEEDED = new Error("API body limit exceeded")
type RequestBodyReadSignalFactory = (timeoutMs: number) => AbortSignal

const createRequestBodyReadSignal: RequestBodyReadSignalFactory = (timeoutMs) =>
  AbortSignal.timeout(timeoutMs)

class ApiBodyReadTimedOutError extends Error {
  constructor() {
    super("API request body read timed out")
    this.name = "ApiBodyReadTimedOutError"
  }
}

const cancelRequestBody = (request: Request): void => {
  try {
    const cancellation = request.body?.cancel()
    void cancellation?.catch((cause: unknown) => {
      console.warn("api_body_cancel_failed", {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    })
  } catch (cause) {
    console.warn("api_body_cancel_failed", {
      error: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

const requestBodyStreamExceedsApiBodyLimit = async (
  request: Request,
  readTimeoutMs: number,
  createReadSignal: RequestBodyReadSignalFactory
): Promise<boolean> => {
  const { body } = request.clone()
  if (!body) {
    return false
  }
  let bytesRead = 0
  const signal = createReadSignal(readTimeoutMs)
  const cancelBodyOnTimeout = () => cancelRequestBody(request)
  if (signal.aborted) {
    cancelBodyOnTimeout()
  } else {
    signal.addEventListener("abort", cancelBodyOnTimeout, { once: true })
  }
  try {
    await body.pipeTo(
      new WritableStream<Uint8Array>({
        write(chunk) {
          bytesRead += chunk.byteLength
          if (bytesRead <= MAX_INBOUND_API_BODY_BYTES) {
            return
          }
          // The cloned request tees its stream, so cancel the original branch
          // while pipeTo cancels this branch after the sink rejects.
          cancelRequestBody(request)
          throw API_BODY_LIMIT_EXCEEDED
        },
      }),
      { signal }
    )
    return false
  } catch (cause) {
    if (cause === API_BODY_LIMIT_EXCEEDED) {
      return true
    }
    if (signal.aborted && cause === signal.reason) {
      throw new ApiBodyReadTimedOutError()
    }
    throw cause
  } finally {
    signal.removeEventListener("abort", cancelBodyOnTimeout)
  }
}

const requestExceedsApiBodyLimit = async (
  request: Request,
  readTimeoutMs: number,
  createReadSignal: RequestBodyReadSignalFactory
): Promise<boolean> =>
  requestDeclaresOversizedApiBody(request) ||
  (request.body !== null &&
    (await requestBodyStreamExceedsApiBodyLimit(
      request,
      readTimeoutMs,
      createReadSignal
    )))

export const createInboundApiBodyLimitMiddleware =
  (
    readTimeoutMs = INBOUND_API_BODY_READ_TIMEOUT_MS,
    createReadSignal = createRequestBodyReadSignal
  ): MiddlewareHandler<RequestLoggingEnvironment> =>
  async (context, next) => {
    let exceedsApiBodyLimit: boolean
    try {
      exceedsApiBodyLimit = await requestExceedsApiBodyLimit(
        context.req.raw,
        readTimeoutMs,
        createReadSignal
      )
    } catch (cause) {
      if (!(cause instanceof ApiBodyReadTimedOutError)) {
        throw cause
      }
      return context.json(
        requestApiError(context, {
          code: "invalid_request",
          error:
            "Request body could not be read before the configured deadline.",
          retryable: true,
        }),
        408
      )
    }
    if (!exceedsApiBodyLimit) {
      return next()
    }
    return context.json(
      requestApiError(context, {
        code: "invalid_request",
        error: "Request body exceeds the configured limit.",
        retryable: false,
      }),
      413
    )
  }
