import { Schema } from "effect"

import {
  extractionCommandFailureSchema,
  type ExtractionCommandFailure,
} from "~/lib/extraction/errors"

export type SavedLinkCommandFailure =
  | {
      readonly kind: "storage-limit"
      readonly usedBytes: number
      readonly limitBytes: number
    }
  | {
      readonly kind: "link-too-large"
      readonly sizeBytes: number
      readonly limitBytes: number
    }
  | { readonly kind: "session-changed" }
  | { readonly kind: "csrf-expired" }
  | { readonly kind: "validation"; readonly message: string }
  | { readonly kind: "temporarily-unavailable"; readonly reference: string }
  | ExtractionCommandFailure

export const SavedLinkCommandFailureSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("storage-limit"),
    usedBytes: Schema.Number,
    limitBytes: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("link-too-large"),
    sizeBytes: Schema.Number,
    limitBytes: Schema.Number,
  }),
  Schema.Struct({ kind: Schema.Literal("session-changed") }),
  Schema.Struct({ kind: Schema.Literal("csrf-expired") }),
  Schema.Struct({
    kind: Schema.Literal("validation"),
    message: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("temporarily-unavailable"),
    reference: Schema.String,
  }),
  extractionCommandFailureSchema,
])

export class SavedLinkCommandError extends Schema.TaggedError<SavedLinkCommandError>()(
  "SavedLinkCommandError",
  { failure: SavedLinkCommandFailureSchema }
) {}
