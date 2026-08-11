import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn() }))

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = mocks.mutation
    query = mocks.query
  },
}))

import { createRemoteCommandNotificationDelivery } from "../workers/remote-command-notification-delivery"

describe("remote command notification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("leaves the outbox pending when no receiver socket was notified", async () => {
    const delivery = createRemoteCommandNotificationDelivery({
      VITE_CONVEX_URL: "https://test.convex.cloud",
      AUTH_GATEWAY_SECRET: "test-secret",
      USER_REALTIME_ROOM: {
        getByName: () => ({
          fetch: async () => Response.json({ deliveredSocketCount: 0 }),
        }),
      } as Env["USER_REALTIME_ROOM"],
    })

    await expect(
      delivery.deliver({
        commandId: "command-one",
        userId: "user-one",
        receiverId: "receiver-one",
      })
    ).resolves.toEqual({ kind: "unavailable" })
    expect(mocks.mutation).not.toHaveBeenCalled()
  })
})
