import { Result, Schema } from "effect"

import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import { getKnownExtractionErrorMessage } from "./extraction-error-message"

const taggedSaveErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})

export const getSaveErrorMessage = (cause: unknown): string => {
  const knownExtractionErrorMessage = getKnownExtractionErrorMessage(cause)
  if (knownExtractionErrorMessage) {
    return knownExtractionErrorMessage
  }

  const parsedError = Schema.decodeUnknownResult(taggedSaveErrorSchema)(cause)
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
    cause,
    "The link couldn’t be opened. Check the link, then try again."
  )
}
