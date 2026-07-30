import { z } from "zod"

export const apiErrorCodeSchema = z.enum([
  "invalid_request",
  "forbidden",
  "invalid_credentials",
  "rate_limited",
  "security_check_required",
  "account_exists",
  "service_unavailable",
])

export const apiErrorResponseSchema = z.strictObject({
  code: apiErrorCodeSchema,
  error: z.string().min(1),
  retryable: z.boolean().optional(),
  requestId: z.string().min(1).optional(),
})

export class ApiResponseError extends Error {
  readonly code: z.infer<typeof apiErrorCodeSchema> | "unknown"
  readonly retryable: boolean
  readonly requestId?: string

  constructor(
    code: z.infer<typeof apiErrorCodeSchema> | "unknown",
    message: string,
    retryable = false,
    requestId?: string
  ) {
    super(message)
    this.name = "ApiResponseError"
    this.code = code
    this.retryable = retryable
    this.requestId = requestId
  }
}

export const createApiErrorResponse = (
  error: z.infer<typeof apiErrorResponseSchema>
) => apiErrorResponseSchema.parse(error)

export const readApiResponseError = async (
  response: Response,
  fallback: string
): Promise<ApiResponseError> => {
  let value: unknown
  try {
    value = await response.json()
  } catch {
    return new ApiResponseError(
      "unknown",
      fallback,
      false,
      response.headers.get("x-request-id") ?? undefined
    )
  }

  const result = apiErrorResponseSchema.safeParse(value)
  if (!result.success) {
    return new ApiResponseError(
      "unknown",
      fallback,
      false,
      response.headers.get("x-request-id") ?? undefined
    )
  }

  return new ApiResponseError(
    result.data.code,
    result.data.error,
    result.data.retryable,
    result.data.requestId ?? response.headers.get("x-request-id") ?? undefined
  )
}
