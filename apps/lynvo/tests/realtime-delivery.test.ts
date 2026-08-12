import { describe, expect, it, vi } from "vitest"
import { deliverRealtimeMessage } from "~/context/realtime/socket"

describe("realtime delivery", () => {
  it("silently consumes heartbeat responses", () => {
    const receiveRemoteEvent = vi.fn()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(
      deliverRealtimeMessage(
        JSON.stringify({ type: "pong", payload: { at: 1_000 } }),
        receiveRemoteEvent
      )
    ).toBe(true)
    expect(receiveRemoteEvent).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

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
