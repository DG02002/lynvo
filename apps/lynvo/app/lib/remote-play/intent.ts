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

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- I/O boundary parser: input is arbitrary unparsed wire JSON from the remote-control socket, and anti-slop/no-unknown-parameters (error) bans spelling that parameter as `unknown`.
export const parseRemotePlaybackIntent = <Value>(value: Value) =>
  Schema.decodeUnknownResult(remotePlaybackIntentSchema)(value)
