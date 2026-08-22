import { describe, expect, it } from "vitest"
import {
  remotePollResponseSchema,
  remoteRealtimeEventSchema,
} from "~/context/remote-control/schemas"

describe("HTTP and realtime boundaries", () => {
  it("validates remote poll devices", () => {
    expect(
      remotePollResponseSchema.safeParse({
        controllingDevices: [{ id: "session-1", name: "Living room" }],
      }).success
    ).toBe(true)
    expect(
      remotePollResponseSchema.safeParse({
        controllingDevices: [{ id: "session-1" }],
      }).success
    ).toBe(false)
    expect(
      remotePollResponseSchema.safeParse({
        commands: [
          {
            command: "play",
            payload: "{}",
            createdAt: 10,
          },
        ],
      }).success
    ).toBe(false)
  })

  it("uses a discriminated union for remote events", () => {
    expect(
      remoteRealtimeEventSchema.safeParse({
        kind: "command",
        id: "command-1",
        claimToken: "claim-1",
        command: "play",
        payload: '{"url":"https://example.com/video","rangeRequest":"unknown"}',
        createdAt: 10,
        targetSessionId: "session-1",
      }).success
    ).toBe(true)
    expect(
      remoteRealtimeEventSchema.safeParse({
        kind: "command",
        command: "play",
      }).success
    ).toBe(false)
  })
})
