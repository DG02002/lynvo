import { describe, expect, it } from "vitest"
import { parseRealtimeMessage } from "~/context/realtime/message-schema"

describe("parseRealtimeMessage", () => {
  it("parses a valid message and strips unknown envelope fields", () => {
    expect(
      parseRealtimeMessage(
        JSON.stringify({
          type: "remote.event",
          payload: { action: "play" },
          ignored: true,
        })
      )
    ).toEqual({
      type: "remote.event",
      payload: { action: "play" },
    })
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
})
