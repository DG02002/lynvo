import { Result, Schema } from "effect"

export const apiErrorCodeSchema = Schema.Literals([
  "invalid_request",
  "forbidden",
  "invalid_credentials",
  "rate_limited",
  "security_check_required",
  "account_exists",
  "service_unavailable",
])

export const apiErrorResponseSchema = Schema.Struct({
  code: apiErrorCodeSchema,
  error: Schema.NonEmptyString,
  retryable: Schema.optional(Schema.Boolean),
  requestId: Schema.optional(Schema.NonEmptyString),
})

export type ApiErrorCode = typeof apiErrorCodeSchema.Type
export type ApiErrorResponse = typeof apiErrorResponseSchema.Type

interface ApiResponseErrorDetails {
  code: ApiErrorCode | "unknown"
  message: string
  retryable?: boolean
  requestId?: string
}

export class ApiResponseError extends Error {
  readonly code: ApiErrorCode | "unknown"
  readonly retryable: boolean
  readonly requestId?: string

  constructor({
    code,
    message,
    retryable = false,
    requestId,
  }: ApiResponseErrorDetails) {
    super(message)
    this.name = "ApiResponseError"
    this.code = code
    this.retryable = retryable
    this.requestId = requestId
  }
}

export const createApiErrorResponse = (
  error: ApiErrorResponse
): ApiErrorResponse => Schema.decodeUnknownSync(apiErrorResponseSchema)(error)

export const readApiResponseError = async (
  response: Response,
  fallback: string
): Promise<ApiResponseError> => {
  let value: unknown
  try {
    value = await response.json()
  } catch {
    return new ApiResponseError({
      code: "unknown",
      message: fallback,
      requestId: response.headers.get("x-request-id") ?? undefined,
    })
  }

  const result = Schema.decodeUnknownResult(apiErrorResponseSchema)(value)
  if (Result.isFailure(result)) {
    return new ApiResponseError({
      code: "unknown",
      message: fallback,
      requestId: response.headers.get("x-request-id") ?? undefined,
    })
  }

  return new ApiResponseError({
    code: result.success.code,
    message: result.success.error,
    retryable: result.success.retryable,
    requestId:
      result.success.requestId ??
      response.headers.get("x-request-id") ??
      undefined,
  })
}
