import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

export const getExtractionErrorMessage = (
  cause: unknown,
  fallback: string
): string => getUserFacingErrorMessage(cause, fallback)
