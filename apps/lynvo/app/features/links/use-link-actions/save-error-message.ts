import { Result, Schema } from "effect"

import type { SavedLinkInteractionError } from "~/features/links/saved-link-interaction"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import { getKnownExtractionErrorMessage } from "./extraction-error-message"

const taggedSaveErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})

type SaveError = Exclude<SavedLinkInteractionError, { kind: "duplicate" }>

const genericSaveError = (message: string): SaveError => ({
  kind: "generic",
  message,
})

export const getSaveError = (cause: unknown): SaveError => {
  const knownExtractionErrorMessage = getKnownExtractionErrorMessage(cause)
  if (knownExtractionErrorMessage) {
    return genericSaveError(knownExtractionErrorMessage)
  }

  const parsedError = Schema.decodeUnknownResult(taggedSaveErrorSchema)(cause)
  if (Result.isFailure(parsedError)) {
    return genericSaveError(
      "The link couldn’t be opened. Check the link, then try again."
    )
  }

  if (parsedError.success._tag === "UnauthorizedError") {
    return genericSaveError(
      "The session expired. Log in, then save the link again."
    )
  }

  if (
    parsedError.success._tag === "ValidationError" &&
    parsedError.success.message
  ) {
    return { kind: "unsupported", message: parsedError.success.message }
  }

  if (parsedError.success._tag === "ExtractionError") {
    return genericSaveError(
      "Links couldn’t be loaded from this address. Check the link, then try again."
    )
  }

  return genericSaveError(
    getUserFacingErrorMessage(
      cause,
      "The link couldn’t be opened. Check the link, then try again."
    )
  )
}

export const getSaveErrorMessage = (cause: unknown): string =>
  getSaveError(cause).message
