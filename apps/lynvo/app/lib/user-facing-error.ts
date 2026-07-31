import { ApiResponseError } from "./api-errors"

const taggedErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) {
    return undefined
  }

  switch (error._tag) {
    case "UnauthorizedError":
      return "The session expired. Log in, then try again."
    case "CsrfError":
      return "The security session expired. Refresh the page, then try again."
    case "ValidationError":
    case "PluginServerRegistrationError":
      return "message" in error && typeof error.message === "string"
        ? error.message
        : undefined
    case "ExtractionError":
      return "Links couldn’t be loaded from this address. Check the link, then try again."
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
