import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  remotePollResponseSchema,
  remoteRealtimeEventSchema,
} from "~/context/remote-control/schemas"

describe("HTTP and realtime boundaries", () => {
  it("validates remote poll devices", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remotePollResponseSchema)({
          controllingDevices: [{ id: "session-1", name: "Living room" }],
        })
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remotePollResponseSchema)({
          controllingDevices: [{ id: "session-1" }],
        })
      )
    ).toBe(false)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remotePollResponseSchema)({
          commands: [
            {
              command: "play",
              payload: "{}",
              createdAt: 10,
            },
          ],
        })
      )
    ).toBe(false)
  })

  it("uses a discriminated union for remote events", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(remoteRealtimeEventSchema)({
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
        Schema.decodeUnknownResult(remoteRealtimeEventSchema)({
          kind: "command",
          command: "play",
        })
      )
    ).toBe(false)
  })
})
