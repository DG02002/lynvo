// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  signSavedLinkRealtimeToken,
  signSessionCleanupToken,
} from "../app/lib/auth-gateway"
import { createConvexTest, insertTestUser } from "./convex-test-harness"

const TEST_GATEWAY_SECRET = "saved-link-realtime-test-secret"

describe("Saved link realtime gateway authorization", () => {
  beforeEach(() => vi.stubEnv("AUTH_GATEWAY_SECRET", TEST_GATEWAY_SECRET))
  afterEach(() => vi.unstubAllEnvs())

  it.each(["", "malformed"])(
    "rejects missing or malformed token %s",
    async (serviceToken) => {
      const convex = createConvexTest()
      await expect(
        convex.query(api.savedLinkRealtime.listPending, { serviceToken })
      ).rejects.toThrow()
    }
  )

  it("rejects wrong-purpose and expired tokens", async () => {
    const convex = createConvexTest()
    const wrongPurpose = await signSessionCleanupToken(
      TEST_GATEWAY_SECRET,
      Date.now() + 60_000
    )
    const expired = await signSavedLinkRealtimeToken(
      TEST_GATEWAY_SECRET,
      Date.now() - 1
    )
    await expect(
      convex.query(api.savedLinkRealtime.listPending, {
        serviceToken: wrongPurpose,
      })
    ).rejects.toThrow()
    await expect(
      convex.query(api.savedLinkRealtime.listPending, {
        serviceToken: expired,
      })
    ).rejects.toThrow("Expired Saved link realtime token")
  })

  it("keeps a newer revision pending when acknowledging an older revision", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "acknowledgement-user")
    await convex.run(async (context) => {
      await context.db.insert("savedLinkSynchronizationStates", {
        userId: user.userId,
        revision: 3,
        broadcastRevision: 0,
        pendingBroadcast: true,
        updatedAt: Date.now(),
      })
    })
    const serviceToken = await signSavedLinkRealtimeToken(
      TEST_GATEWAY_SECRET,
      Date.now() + 60_000
    )
    await convex.mutation(api.savedLinkRealtime.acknowledge, {
      serviceToken,
      userId: user.userId,
      revision: 2,
    })
    expect(
      await convex.query(api.savedLinkRealtime.listPending, { serviceToken })
    ).toEqual([{ userId: user.userId, revision: 3 }])
    await convex.mutation(api.savedLinkRealtime.acknowledge, {
      serviceToken,
      userId: user.userId,
      revision: 3,
    })
    expect(
      await convex.query(api.savedLinkRealtime.listPending, { serviceToken })
    ).toEqual([])
  })
})
