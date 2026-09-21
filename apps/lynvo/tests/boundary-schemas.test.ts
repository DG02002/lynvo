import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"

import { RemotePollResponseSchema } from "~/lib/api-contracts"
import { remoteCommandWirePayloadSchema } from "~/lib/remote-play/wire"

describe("HTTP and realtime boundaries", () => {
  it("uses the canonical remote command fields in HTTP responses", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(RemotePollResponseSchema)({
          commands: [
            {
              id: "command-1",
              claimToken: "claim-1",
              command: "play",
              payload: "{}",
              createdAt: 10,
            },
          ],
          dataVersion: 1,
        })
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(RemotePollResponseSchema)({
          commands: [
            {
              id: "command-1",
              command: "play",
              payload: "{}",
              createdAt: 10,
            },
          ],
          dataVersion: 1,
        })
      )
    ).toBe(false)
  })

  it("uses a discriminated union for remote command events", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remoteCommandWirePayloadSchema)({
          kind: "command",
          id: "command-1",
          claimToken: "claim-1",
          command: "play",
          payload:
            '{"url":"https://example.com/video","rangeRequest":"unknown"}',
          createdAt: 10,
          targetSessionId: "session-1",
        })
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remoteCommandWirePayloadSchema)({
          kind: "command",
          command: "play",
        })
      )
    ).toBe(false)
  })
})
