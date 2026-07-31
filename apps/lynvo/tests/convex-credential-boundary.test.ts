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

  it("redacts encrypted worker credentials from browser queries", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "worker-boundary-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const workerId = await client.mutation(api.userWorkers.createPending, {
      baseUrl: "https://worker.example",
      manifest: "{}",
      enabled: true,
      priority: 0,
      verificationStatus: "verified",
    })
    await client.mutation(api.userWorkers.finalizeEncryptedCredential, {
      id: workerId,
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM",
      apiKeyVersion: 1,
    })

    const publicWorkers = await client.query(api.userWorkers.list, {})
    expect(publicWorkers).toHaveLength(1)
    expect(publicWorkers[0]).not.toHaveProperty("apiKey")
    expect(publicWorkers[0]).not.toHaveProperty("apiKeyCiphertext")

    const serviceToken = await signCredentialReadToken(
      TEST_GATEWAY_SECRET,
      Date.now() + 60_000
    )
    const serviceWorkers = await client.query(api.userWorkers.listForService, {
      serviceToken,
    })
    expect(serviceWorkers[0]).toMatchObject({
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM",
      apiKeyVersion: 1,
    })
    expect(serviceWorkers[0]).not.toHaveProperty("apiKey")
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
