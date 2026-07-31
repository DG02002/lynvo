import { ApiResponseError } from "./api-errors"

const taggedErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) {
    return undefined
  }

  switch (error._tag) {
    case "UnauthorizedError":
      return "Session expired. Sign in again."
    case "CsrfError":
      return "Your security session expired. Refresh the page and try again."
    case "ValidationError":
    case "PluginServerRegistrationError":
      return "message" in error && typeof error.message === "string"
        ? error.message
        : undefined
    case "ExtractionError":
      return "Unable to extract links from this URL. Check the link and try again."
    default:
      return undefined
  }
}

export const getUserFacingErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (error instanceof ApiResponseError) {
    const reference = error.requestId ? ` Reference: ${error.requestId}` : ""
    return `${error.message}${reference}`
  }

  return taggedErrorMessage(error)?.trim() || fallback
}
