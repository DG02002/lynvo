import { Schema } from "effect"

declare global {
  type SavedLinkCommandFailure =
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
    | { readonly kind: "session-expired" }
    | { readonly kind: "session-changed" }
    | { readonly kind: "csrf-expired" }
    | { readonly kind: "validation"; readonly message: string }
    | { readonly kind: "temporarily-unavailable"; readonly reference: string }
}

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
  Schema.Struct({ kind: Schema.Literal("session-expired") }),
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
])

export class SavedLinkCommandError extends Schema.TaggedError<SavedLinkCommandError>()(
  "SavedLinkCommandError",
  { failure: SavedLinkCommandFailureSchema }
) {}

const unreachableFailure = (failure: never): never => {
  throw new Error(`Unhandled Saved link command failure: ${String(failure)}`)
}

export const presentSavedLinkCommandFailure = (
  failure: SavedLinkCommandFailure
): string => {
  switch (failure.kind) {
    case "storage-limit":
      return "Account storage is full. Remove a saved link, then try again."
    case "link-too-large":
      return "This saved link is too large. Remove some extracted items, then try again."
    case "session-expired":
      return "The session expired. Log in, then try again."
    case "session-changed":
      return "The signed-in account changed. Try again from the current account."
    case "csrf-expired":
      return "The security session expired. Refresh the page, then try again."
    case "validation":
      return failure.message
    case "temporarily-unavailable":
      return `The link couldn’t be saved right now. Try again. Reference: ${failure.reference}`
    default:
      return unreachableFailure(failure)
  }
}
