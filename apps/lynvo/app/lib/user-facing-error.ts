import { ApiResponseError } from "./api-errors"
import { z } from "zod"

const taggedErrorSchema = z.object({
  _tag: z.string(),
  message: z.string().optional(),
})

const taggedErrorMessage = <Value>(error: Value): string | undefined => {
  const parsed = taggedErrorSchema.safeParse(error)
  if (!parsed.success) {
    return undefined
  }

  switch (parsed.data._tag) {
    case "UnauthorizedError":
      return "The session expired. Log in, then try again."
    case "CsrfError":
      return "The security session expired. Refresh the page, then try again."
    case "ValidationError":
    case "PluginServerRegistrationError":
      return parsed.data.message
    case "ExtractionError":
      return "Links couldn’t be loaded from this address. Check the link, then try again."
    default:
      return undefined
  }
}

export const getUserFacingErrorMessage = <Value>(
  error: Value,
  fallback: string
): string => {
  if (error instanceof ApiResponseError) {
    const reference = error.requestId ? ` Reference: ${error.requestId}` : ""
    return `${error.message}${reference}`
  }

  return taggedErrorMessage(error)?.trim() || fallback
}
