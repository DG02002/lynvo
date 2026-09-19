import { UNSUPPORTED_URL_CODE } from "@dg02002/lynvo-plugin-server-protocol"
import { Result, Schema } from "effect"

import type { SavedLinkInteractionError } from "~/features/links/saved-link-interaction"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import { getKnownExtractionErrorMessage } from "./extraction-error-message"

const taggedSaveErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})

type SaveError = Exclude<SavedLinkInteractionError, { kind: "duplicate" }>
type ParsedSaveError = typeof taggedSaveErrorSchema.Type

const UNSUPPORTED_URL_FALLBACK_MESSAGE = "The link is not supported."

const genericSaveError = (message: string): SaveError => ({
  kind: "generic",
  message,
})

const getUnsupportedUrlMessage = (
  error: ParsedSaveError
): string | undefined => {
  return error._tag === "ExtractionError" &&
    error.message !== undefined &&
    error.message === UNSUPPORTED_URL_CODE
    ? UNSUPPORTED_URL_FALLBACK_MESSAGE
    : undefined
}

export const getSaveError = (cause: unknown): SaveError => {
  const parsedError = Schema.decodeUnknownResult(taggedSaveErrorSchema)(cause)
  if (Result.isSuccess(parsedError)) {
    const unsupportedUrlMessage = getUnsupportedUrlMessage(parsedError.success)
    if (unsupportedUrlMessage) {
      return { kind: "unsupported", message: unsupportedUrlMessage }
    }

    if (parsedError.success._tag === "UnauthorizedError") {
      return genericSaveError(
        "The session expired. Log in, then save the link again."
      )
    }

    if (parsedError.success._tag === "ExtractionError") {
      return genericSaveError(
        "Links couldn’t be loaded from this address. Check the link, then try again."
      )
    }
  }

  const knownExtractionErrorMessage = getKnownExtractionErrorMessage(cause)
  if (knownExtractionErrorMessage) {
    return genericSaveError(knownExtractionErrorMessage)
  }

  if (Result.isFailure(parsedError)) {
    return genericSaveError(
      "The link couldn’t be opened. Check the link, then try again."
    )
  }

  return genericSaveError(
    getUserFacingErrorMessage(
      cause,
      "The link couldn’t be opened. Check the link, then try again."
    )
  )
}
