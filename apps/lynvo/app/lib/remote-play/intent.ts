import { Effect, Schema } from "effect"

export const remotePlaybackIntentSchema = Schema.Struct({
  url: Schema.String.pipe(
    Schema.refine(
      (value): value is string => {
        try {
          const parsedUrl = new URL(value)
          return parsedUrl.protocol.length > 0
        } catch {
          return false
        }
      },
      { message: "Invalid URL" }
    )
  ),
  rangeRequest: Schema.Literals(["supported", "unsupported", "unknown"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("unknown" as const))
  ),
})

export const parseRemotePlaybackIntent = <Value>(value: Value) =>
  Schema.decodeUnknownResult(remotePlaybackIntentSchema)(value)
