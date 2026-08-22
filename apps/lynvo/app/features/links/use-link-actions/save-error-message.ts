import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { Result, Schema } from "effect"

const taggedSaveErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})

export const getSaveErrorMessage = <Value>(error: Value): string => {
  const parsedError = Schema.decodeUnknownResult(taggedSaveErrorSchema)(error)
  if (Result.isFailure(parsedError)) {
    return "The link couldn’t be opened. Check the link, then try again."
  }

  if (parsedError.success._tag === "UnauthorizedError") {
    return "The session expired. Log in, then save the link again."
  }

  if (
    parsedError.success._tag === "ValidationError" &&
    parsedError.success.message
  ) {
    return parsedError.success.message
  }

  if (parsedError.success._tag === "ExtractionError") {
    return "Links couldn’t be loaded from this address. Check the link, then try again."
  }

  return getUserFacingErrorMessage(
    error,
    "The link couldn’t be opened. Check the link, then try again."
  )
}
