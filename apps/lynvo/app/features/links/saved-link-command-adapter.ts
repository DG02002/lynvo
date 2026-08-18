import { Schema } from "effect"
import {
  SavedLinkCommandFailureSchema,
  SavedLinkCommandError,
} from "./saved-link-command-failure"

const dependencyFailureSchema = Schema.Struct({
  data: SavedLinkCommandFailureSchema,
})

export const toSavedLinkCommandError = (
  cause: unknown,
  requestReference: string
): SavedLinkCommandError => {
  try {
    const dependencyFailure = Schema.decodeUnknownSync(dependencyFailureSchema)(
      cause
    )
    return new SavedLinkCommandError({ failure: dependencyFailure.data })
  } catch {
    return new SavedLinkCommandError({
      failure: {
        kind: "temporarily-unavailable",
        reference: requestReference,
      },
    })
  }
}

export const runSavedLinkCommand = async <Result>(
  execute: () => Promise<Result>
): Promise<Result> => {
  try {
    return await execute()
  } catch (error) {
    if (
      error instanceof SavedLinkCommandError &&
      error.failure.kind === "temporarily-unavailable"
    ) {
      return await execute()
    }
    throw error
  }
}
