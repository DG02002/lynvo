// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import { signCredentialReadToken } from "../app/lib/auth-gateway"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

const TEST_GATEWAY_SECRET = "credential-boundary-test-secret"

describe("Convex credential boundary", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_GATEWAY_SECRET", TEST_GATEWAY_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("redacts worker API keys from browser queries", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "worker-boundary-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    await client.mutation(api.userWorkers.create, {
      baseUrl: "https://worker.example",
      apiKey: "worker-secret",
      manifest: "{}",
      enabled: true,
      priority: 0,
      verificationStatus: "verified",
    })

    const publicWorkers = await client.query(api.userWorkers.list, {})
    expect(publicWorkers).toHaveLength(1)
    expect(publicWorkers[0]).not.toHaveProperty("apiKey")

    const serviceToken = await signCredentialReadToken(
      TEST_GATEWAY_SECRET,
      Date.now() + 60_000
    )
    const serviceWorkers = await client.query(api.userWorkers.listForService, {
      serviceToken,
    })
    expect(serviceWorkers[0]?.apiKey).toBe("worker-secret")
  })

  it("rejects service credential reads without a valid signature", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "invalid-service-token-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)

    await expect(
      client.query(api.userWorkers.listForService, {
        serviceToken: "invalid-token",
      })
    ).rejects.toThrow("Invalid auth preflight token")
  })
})
