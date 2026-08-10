import { describe, expect, it, vi } from "vitest"
import { createSavedLinkRealtimeDelivery } from "../workers/saved-link-realtime-delivery"

const environment = {
  VITE_CONVEX_URL: "https://test.convex.cloud",
  AUTH_GATEWAY_SECRET: "test-secret",
}

const createAdapters = (
  pending: PendingSavedLinkDelivery[] = []
): SavedLinkRealtimeDeliveryAdapters => ({
  listPending: vi.fn(async () => pending),
  broadcast: vi.fn(async () => undefined),
  acknowledge: vi.fn(async () => undefined),
})

describe("Saved link realtime delivery", () => {
  it("leaves work pending when broadcast fails", async () => {
    const adapters = createAdapters()
    vi.mocked(adapters.broadcast).mockRejectedValue(new Error("offline"))
    const result = await createSavedLinkRealtimeDelivery(
      environment,
      adapters
    ).deliver("user-one", 2)
    expect(result).toMatchObject({ kind: "unavailable", failed: 1 })
    expect(adapters.acknowledge).not.toHaveBeenCalled()
  })

  it("allows acknowledgement failure to retry as a harmless duplicate", async () => {
    const adapters = createAdapters([{ userId: "user-one", revision: 2 }])
    vi.mocked(adapters.acknowledge)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined)
    const delivery = createSavedLinkRealtimeDelivery(environment, adapters)
    expect(await delivery.drain()).toMatchObject({ failed: 1, broadcast: 1 })
    expect(await delivery.drain()).toMatchObject({ acknowledged: 1 })
    expect(adapters.broadcast).toHaveBeenCalledTimes(2)
  })

  it("isolates a failed account and treats an empty drain as success", async () => {
    const adapters = createAdapters([
      { userId: "user-one", revision: 1 },
      { userId: "user-two", revision: 3 },
    ])
    vi.mocked(adapters.broadcast).mockRejectedValueOnce(new Error("offline"))
    const result = await createSavedLinkRealtimeDelivery(
      environment,
      adapters
    ).drain()
    expect(result).toMatchObject({ listed: 2, failed: 1, acknowledged: 1 })
    expect(adapters.broadcast).toHaveBeenCalledTimes(2)

    const empty = createAdapters()
    expect(
      await createSavedLinkRealtimeDelivery(environment, empty).drain()
    ).toEqual({
      kind: "completed",
      listed: 0,
      broadcast: 0,
      acknowledged: 0,
      failed: 0,
    })
  })
})
