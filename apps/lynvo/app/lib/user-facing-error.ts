import { UNSUPPORTED_URL_CODE } from "@dg02002/lynvo-plugin-server-protocol"
import { Result, Schema } from "effect"

import { ApiResponseError } from "./api-errors"
import {
  ExtractionCommandError,
  presentExtractionFailure,
} from "./extraction/errors"
import { sessionExpiredCopy } from "./session-copy"

const unreachable = (value: never): never => {
  throw new Error(`Unhandled user-facing error case: ${String(value)}`)
}

export const csrfExpiredMessage =
  "The security session expired. Refresh the page, then try again."
export const extractionErrorMessage =
  "Links couldn’t be loaded from this address. Check the link, then try again."
export const unsupportedLinkMessage = "The link is not supported."

export type SaveIntentErrorKind =
  | "missing-url"
  | "invalid-url"
  | "no-selection"
  | "write-failed"

export const getSaveIntentErrorMessage = (
  kind: SaveIntentErrorKind
): string | undefined => {
  switch (kind) {
    case "missing-url":
      return "Enter a URL."
    case "invalid-url":
      return "Enter a valid URL."
    case "no-selection":
      return "Select at least one link."
    case "write-failed":
      return undefined
    default:
      return unreachable(kind)
  }
}

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
      return csrfExpiredMessage
    case "ValidationError":
    case "NotFoundError":
    case "UsageLimitError":
    case "PluginServerRegistrationError":
    case "ProxyProviderError":
    case "PluginDomainNotFoundError":
    case "PluginServerUnavailableError":
    case "PluginCredentialChangeSupersededError":
      return parsed.success.message
    case "ExtractionError":
      return parsed.success.message === UNSUPPORTED_URL_CODE
        ? unsupportedLinkMessage
        : extractionErrorMessage
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

  if (cause instanceof ExtractionCommandError) {
    return presentExtractionFailure(cause.failure)
  }

  return taggedErrorMessage(cause)?.trim() || fallback
}
