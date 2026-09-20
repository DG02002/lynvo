import { Result, Schema } from "effect"

import { ApiResponseError } from "./api-errors"
import { sessionExpiredCopy } from "./session-copy"

const taggedErrorSchema = Schema.Struct({
  _tag: Schema.String,
  message: Schema.optional(Schema.String),
})

const taggedErrorMessage = (cause: unknown): string | undefined => {
  const parsed = Schema.decodeUnknownResult(taggedErrorSchema)(cause)
  if (Result.isFailure(parsed)) {
    return undefined
  }

  switch (parsed.success._tag) {
    case "UnauthorizedError":
      return sessionExpiredCopy.retry
    case "CsrfError":
      return "The security session expired. Refresh the page, then try again."
    case "ValidationError":
    case "NotFoundError":
    case "UsageLimitError":
    case "PluginServerRegistrationError":
    case "PluginDomainNotFoundError":
    case "PluginServerUnavailableError":
    case "PluginCredentialChangeSupersededError":
      return parsed.success.message
    case "ExtractionError":
      return "Links couldn’t be loaded from this address. Check the link, then try again."
    default:
      return undefined
  }
}

export const getUserFacingErrorMessage = (
  cause: unknown,
  fallback: string
): string => {
  if (cause instanceof ApiResponseError) {
    const reference = cause.requestId ? ` Reference: ${cause.requestId}` : ""
    return `${cause.message}${reference}`
  }

  return taggedErrorMessage(cause)?.trim() || fallback
}
