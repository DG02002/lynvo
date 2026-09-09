import { Schema } from "effect"

export const extractionCommandFailureSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("session-expired") }),
  Schema.Struct({ kind: Schema.Literal("transient") }),
  Schema.Struct({
    kind: Schema.Literal("rate-limited"),
    retryAfterSeconds: Schema.optional(Schema.Number),
  }),
  Schema.Struct({ kind: Schema.Literal("plugin-server-down") }),
])

export type ExtractionCommandFailure =
  typeof extractionCommandFailureSchema.Type

export class ExtractionCommandError extends Schema.TaggedError<ExtractionCommandError>()(
  "ExtractionCommandError",
  { failure: extractionCommandFailureSchema }
) {}

export const presentExtractionFailure = (
  failure: ExtractionCommandFailure
): string => {
  switch (failure.kind) {
    case "session-expired":
      return "The session expired. Log in, then try again."
    case "transient":
      return "Extraction is temporarily unavailable. Try again in a moment."
    case "rate-limited":
      return "Extraction is rate-limited. Wait a moment, then try again."
    case "plugin-server-down":
      return "The Plugin Server is unavailable. Try again later or choose another Plugin Server."
  }
}
