import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

interface TaggedSaveError {
  _tag?: unknown
  message?: unknown
}

const isTaggedSaveError = (error: unknown): error is TaggedSaveError =>
  typeof error === "object" && error !== null

export const getSaveErrorMessage = (error: unknown): string => {
  if (!isTaggedSaveError(error)) {
    return "Unable to process this link. Try again."
  }

  if (error._tag === "UnauthorizedError") {
    return "Session expired. Sign in again."
  }

  if (error._tag === "ValidationError" && typeof error.message === "string") {
    return error.message
  }

  if (error._tag === "ExtractionError") {
    return "Unable to extract links from this URL. Check the link and try again."
  }

  return getUserFacingErrorMessage(
    error,
    "Unable to process this link. Try again."
  )
}
