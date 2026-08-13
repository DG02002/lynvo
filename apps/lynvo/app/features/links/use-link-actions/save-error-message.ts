import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { z } from "zod"

const taggedSaveErrorSchema = z.object({
  _tag: z.string().optional(),
  message: z.string().optional(),
})

export const getSaveErrorMessage = <Value>(error: Value): string => {
  const parsedError = taggedSaveErrorSchema.safeParse(error)
  if (!parsedError.success) {
    return "The link couldn’t be opened. Check the link, then try again."
  }

  if (parsedError.data._tag === "UnauthorizedError") {
    return "The session expired. Log in, then save the link again."
  }

  if (parsedError.data._tag === "ValidationError" && parsedError.data.message) {
    return parsedError.data.message
  }

  if (parsedError.data._tag === "ExtractionError") {
    return "Links couldn’t be loaded from this address. Check the link, then try again."
  }

  return getUserFacingErrorMessage(
    error,
    "The link couldn’t be opened. Check the link, then try again."
  )
}
