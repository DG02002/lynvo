import { describe, expect, it, vi } from "vitest"
import { createRealtimeSessionRevocation } from "../workers/realtime-session-revocation"

describe("realtime session revocation", () => {
  it("targets one session or every socket in an account room", async () => {
    const fetch = vi.fn(async () => Response.json({ success: true }))
    const realtimeRoom = {
      getByName: vi.fn(() => ({ fetch })),
    }
    const revocation = createRealtimeSessionRevocation(realtimeRoom)

    await revocation.closeSession("account-one", "session-one")
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://user-realtime-room/revoke-session",
      {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-one" }),
      }
    )
    await revocation.closeAccount("account-one")
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://user-realtime-room/revoke-account",
      { method: "POST" }
    )
    expect(realtimeRoom.getByName).toHaveBeenCalledWith("account-one")
  })
})
