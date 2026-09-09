import {
  SavedLinkCommandError,
  presentSavedLinkCommandFailure,
} from "../saved-link-command-failure"
import {
  ExtractionCommandError,
  presentExtractionFailure,
} from "~/lib/extraction/errors"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

export const getExtractionErrorMessage = (
  cause: unknown,
  fallback: string
): string => {
  if (cause instanceof ExtractionCommandError) {
    return presentExtractionFailure(cause.failure)
  }
  if (cause instanceof SavedLinkCommandError) {
    return presentSavedLinkCommandFailure(cause.failure)
  }
  return getUserFacingErrorMessage(cause, fallback)
}
