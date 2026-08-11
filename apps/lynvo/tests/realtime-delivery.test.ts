import { describe, expect, it, vi } from "vitest"
import { deliverRealtimeMessage } from "~/context/realtime/socket"

describe("realtime delivery", () => {
  it("delivers a validated Remote Play command through the typed seam", () => {
    const receiveRemoteEvent = vi.fn()
    const message = {
      type: "remote.event",
      payload: {
        kind: "command",
        id: "command-one",
        claimToken: "claim-one",
        command: "play",
        payload: JSON.stringify({ url: "https://example.com/video" }),
        createdAt: 1,
        targetSessionId: "session-one",
      },
    }

    expect(
      deliverRealtimeMessage(JSON.stringify(message), receiveRemoteEvent)
    ).toBe(true)
    expect(receiveRemoteEvent).toHaveBeenCalledWith(message)
  })

  it("does not deliver invalid Remote Play payloads", () => {
    const receiveRemoteEvent = vi.fn()

    expect(
      deliverRealtimeMessage(
        JSON.stringify({
          type: "remote.event",
          payload: { kind: "command", command: "delete-everything" },
        }),
        receiveRemoteEvent
      )
    ).toBe(false)
    expect(receiveRemoteEvent).not.toHaveBeenCalled()
  })
})
