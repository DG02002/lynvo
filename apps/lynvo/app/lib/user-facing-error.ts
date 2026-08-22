import { ApiResponseError } from "./api-errors"
import { Result, Schema } from "effect"

const taggedErrorSchema = Schema.Struct({
  _tag: Schema.String,
  message: Schema.optional(Schema.String),
})

const taggedErrorMessage = <Value>(error: Value): string | undefined => {
  const parsed = Schema.decodeUnknownResult(taggedErrorSchema)(error)
  if (Result.isFailure(parsed)) {
    return undefined
  }

  switch (parsed.success._tag) {
    case "UnauthorizedError":
      return "The session expired. Log in, then try again."
    case "CsrfError":
      return "The security session expired. Refresh the page, then try again."
    case "ValidationError":
    case "PluginServerRegistrationError":
      return parsed.success.message
    case "ExtractionError":
      return "Links couldn’t be loaded from this address. Check the link, then try again."
    default:
      return undefined
  }
}

export const getUserFacingErrorMessage = <Value>(
  error: Value,
  fallback: string
): string => {
  if (error instanceof ApiResponseError) {
    const reference = error.requestId ? ` Reference: ${error.requestId}` : ""
    return `${error.message}${reference}`
  }

  return taggedErrorMessage(error)?.trim() || fallback
}
