import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

interface TaggedSaveError {
  _tag?: unknown
  message?: unknown
}

const isTaggedSaveError = (error: unknown): error is TaggedSaveError =>
  typeof error === "object" && error !== null

export const getSaveErrorMessage = (error: unknown): string => {
  if (!isTaggedSaveError(error)) {
    return "The link couldn’t be opened. Check the link, then try again."
  }

  if (error._tag === "UnauthorizedError") {
    return "The session expired. Log in, then save the link again."
  }

  if (error._tag === "ValidationError" && typeof error.message === "string") {
    return error.message
  }

  if (error._tag === "ExtractionError") {
    return "Links couldn’t be loaded from this address. Check the link, then try again."
  }

  return getUserFacingErrorMessage(
    error,
    "The link couldn’t be opened. Check the link, then try again."
  )
}
