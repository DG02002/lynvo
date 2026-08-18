import { describe, expect, it } from "vitest"
import { parseRealtimeMessage } from "~/context/realtime/message-schema"
import { createRemoteCommandMessage } from "~/lib/remote-play/wire"

describe("parseRealtimeMessage", () => {
  it("rejects unknown realtime message types", () => {
    expect(
      parseRealtimeMessage(
        JSON.stringify({
          type: "notification",
          payload: { action: "play" },
          ignored: true,
        })
      )
    ).toBeNull()
  })

  it.each([
    "not json",
    JSON.stringify(null),
    JSON.stringify({}),
    JSON.stringify({ type: "", payload: {} }),
    JSON.stringify({ type: "remote.event", payload: "invalid" }),
  ])("rejects an invalid message boundary", (value) => {
    expect(parseRealtimeMessage(value)).toBeNull()
  })

  it("accepts the exact Remote Play sender envelope", () => {
    const message = createRemoteCommandMessage({
      id: "command-1",
      claimToken: "claim-1",
      command: "play",
      payload: '{"url":"https://example.com/video"}',
      createdAt: 1_000_000,
      targetSessionId: "session-1",
    })

    expect(parseRealtimeMessage(JSON.stringify(message))).toEqual(message)
  })

  it("rejects malformed Remote Play commands", () => {
    expect(
      parseRealtimeMessage(
        JSON.stringify({
          type: "remote.event",
          payload: {
            kind: "command",
            id: "",
            command: "stop",
            payload: "{}",
            createdAt: -1,
            targetSessionId: "",
          },
        })
      )
    ).toBeNull()
  })
})
