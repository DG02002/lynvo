import {
  SavedLinkCommandError,
  type SavedLinkCommandFailure,
} from "~/features/links/saved-link-command-failure"
import { presentExtractionFailure } from "~/lib/extraction/errors"
import {
  csrfExpiredMessage,
  getUserFacingErrorMessage,
} from "~/lib/user-facing-error"

const unreachable = (value: never): never => {
  throw new Error(`Unhandled saved-link failure case: ${String(value)}`)
}

const withReference = (message: string, reference?: string): string =>
  reference ? `${message} Reference: ${reference}` : message

export const presentSavedLinkCommandFailure = (
  failure: SavedLinkCommandFailure
): string => {
  switch (failure.kind) {
    case "storage-limit":
      return "Account storage is full. Remove a saved link, then try again."
    case "link-too-large":
      return "This saved link is too large. Remove some extracted items, then try again."
    case "session-expired":
    case "transient":
    case "rate-limited":
    case "plugin-server-down":
      return presentExtractionFailure(failure)
    case "session-changed":
      return "The signed-in account changed. Try again from the current account."
    case "csrf-expired":
      return csrfExpiredMessage
    case "validation":
      return failure.message
    case "temporarily-unavailable":
      return withReference(
        "The link couldn’t be saved right now. Try again.",
        failure.reference
      )
    default:
      return unreachable(failure)
  }
}

export const getLinkErrorMessage = (
  cause: unknown,
  fallback: string
): string =>
  cause instanceof SavedLinkCommandError
    ? presentSavedLinkCommandFailure(cause.failure)
    : getUserFacingErrorMessage(cause, fallback)
