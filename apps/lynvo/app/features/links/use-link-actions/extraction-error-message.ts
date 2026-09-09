import {
  SavedLinkCommandError,
  presentSavedLinkCommandFailure,
} from "../saved-link-command-failure"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

export const getExtractionErrorMessage = <Value>(
  error: Value,
  fallback: string
): string =>
  error instanceof SavedLinkCommandError
    ? presentSavedLinkCommandFailure(error.failure)
    : getUserFacingErrorMessage(error, fallback)
