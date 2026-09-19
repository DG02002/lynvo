import { Result, Schema } from "effect"

import type { SavedLinkInteractionError } from "~/features/links/saved-link-interaction"
import { UNSUPPORTED_URL_CODE } from "~/lib/extraction/errors"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import { getKnownExtractionErrorMessage } from "./extraction-error-message"

const taggedSaveErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  detail: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Unknown),
  failure: Schema.optional(Schema.Unknown),
})

type SaveError = Exclude<SavedLinkInteractionError, { kind: "duplicate" }>
type ParsedSaveError = typeof taggedSaveErrorSchema.Type

const unsupportedUrlDetailsSchema = Schema.Struct({
  code: Schema.Literal(UNSUPPORTED_URL_CODE),
})

const unsupportedUrlFailureSchema = Schema.Struct({
  kind: Schema.Literal("validation"),
  code: Schema.Literal(UNSUPPORTED_URL_CODE),
  message: Schema.optional(Schema.String),
})

const genericSaveError = (message: string): SaveError => ({
  kind: "generic",
  message,
})

const getUnsupportedUrlMessage = (
  error: ParsedSaveError
): string | undefined => {
  if (error.code === UNSUPPORTED_URL_CODE) {
    return error.message ?? error.detail ?? "The link is not supported."
  }

  if (
    error._tag === "ExtractionError" &&
    error.message === UNSUPPORTED_URL_CODE
  ) {
    return error.detail ?? "The link is not supported."
  }

  const details = Schema.decodeUnknownResult(unsupportedUrlDetailsSchema)(
    error.details
  )
  if (Result.isSuccess(details)) {
    return error.message ?? "The link is not supported."
  }

  const failure = Schema.decodeUnknownResult(unsupportedUrlFailureSchema)(
    error.failure
  )
  return Result.isSuccess(failure)
    ? (failure.success.message ?? error.message ?? "The link is not supported.")
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
