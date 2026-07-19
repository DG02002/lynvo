const TECHNICAL_ERROR_PATTERN =
  /decode error|encode error|\/api\/|http\.(method|url|status)|fiberfailure|responseerror|requesterror|schema\.js|effect\/dist/i

const getErrorText = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return undefined
}

export const getUserFacingErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  const message = getErrorText(error)?.trim()
  if (!message || TECHNICAL_ERROR_PATTERN.test(message)) {
    return fallback
  }
  return message
}
