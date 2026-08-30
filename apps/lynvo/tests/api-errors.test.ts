import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"
import {
  BackendApiError,
  CsrfApiError,
  NotFoundApiError,
  UnauthorizedApiError,
  ValidationApiError,
} from "~/lib/effect/errors"
import {
  ApiResponseError,
  apiErrorResponseSchema,
  createApiErrorResponse,
  readApiResponseError,
} from "~/lib/api-errors"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

describe("API errors", () => {
  it("creates a stable response envelope with support information", () => {
    expect(
      createApiErrorResponse({
        code: "service_unavailable",
        error: "Login is temporarily unavailable. Try again later.",
        retryable: true,
        requestId: "request-123",
      })
    ).toEqual({
      code: "service_unavailable",
      error: "Login is temporarily unavailable. Try again later.",
      retryable: true,
      requestId: "request-123",
    })
  })

  it("decodes trusted API errors and ignores malformed server responses", async () => {
    await expect(
      readApiResponseError(
        new Response(
          JSON.stringify({
            code: "rate_limited",
            error: "Too many attempts. Try again later.",
            retryable: true,
          }),
          {
            status: 429,
            headers: { "x-request-id": "request-456" },
          }
        ),
        "Request failed."
      )
    ).resolves.toMatchObject({
      code: "rate_limited",
      message: "Too many attempts. Try again later.",
      requestId: "request-456",
      retryable: true,
    })

    await expect(
      readApiResponseError(
        new Response(JSON.stringify({ error: "internal stack details" }), {
          status: 500,
        }),
        "Request failed."
      )
    ).resolves.toEqual(
      new ApiResponseError({ code: "unknown", message: "Request failed." })
    )
  })

  it("only presents trusted API and domain messages", () => {
    expect(
      getUserFacingErrorMessage(
        new ApiResponseError({
          code: "service_unavailable",
          message: "The service is temporarily unavailable.",
          retryable: true,
          requestId: "request-789",
        }),
        "Request failed."
      )
    ).toBe("The service is temporarily unavailable. Reference: request-789")
    expect(
      getUserFacingErrorMessage(
        new Error("Missing environment variable JWT_PRIVATE_KEY"),
        "Request failed."
      )
    ).toBe("Request failed.")
    expect(
      getUserFacingErrorMessage(
        { _tag: "ValidationError", message: "Enter a supported URL." },
        "Request failed."
      )
    ).toBe("Enter a supported URL.")
  })

  it("assigns semantic HTTP statuses to Effect errors", () => {
    expect(HttpApiSchema.getStatusError(ValidationApiError.ast)).toBe(400)
    expect(HttpApiSchema.getStatusError(UnauthorizedApiError.ast)).toBe(401)
    expect(HttpApiSchema.getStatusError(CsrfApiError.ast)).toBe(403)
    expect(HttpApiSchema.getStatusError(NotFoundApiError.ast)).toBe(404)
    expect(HttpApiSchema.getStatusError(BackendApiError.ast)).toBe(503)
  })

  it("rejects unknown error codes at the HTTP boundary", () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(apiErrorResponseSchema)({
          code: "unknown_auth_error",
          error: "Authentication failed",
        })
      )
    ).toBe(true)
  })
})
