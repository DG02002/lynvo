import { Schema } from "effect"
import {
  SavedLinkCommandFailureSchema,
  SavedLinkCommandError,
} from "./saved-link-command-failure"
import { runWithRetries } from "~/lib/retry"

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
): Promise<Result> =>
  runWithRetries(execute, {
    maxRetries: 1,
    getDelayMs: (cause) =>
      cause instanceof SavedLinkCommandError &&
      cause.failure.kind === "temporarily-unavailable"
        ? 0
        : undefined,
  })
