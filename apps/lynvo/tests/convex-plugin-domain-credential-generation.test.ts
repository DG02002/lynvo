// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

const encryptedCredential = (ciphertext: string): EncryptedCredentialInput => ({
  ciphertext,
  nonce: "nonce",
  algorithm: "AES-256-GCM",
  keyVersion: 1,
})

describe("Plugin Domain credential generations", () => {
  it("allows only the latest competing replacement to finalize", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "domain-generation-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const domainId = await client.mutation(api.pluginDomains.create, {
      domain: "private.example",
      pluginServerId: "server-one",
      pluginId: "plugin-one",
    })
    const first = await client.mutation(
      api.pluginDomains.beginCredentialChange,
      { id: domainId }
    )
    const second = await client.mutation(
      api.pluginDomains.beginCredentialChange,
      { id: domainId }
    )

    await expect(
      client.mutation(api.pluginDomains.finalizeCredentialChange, {
        id: domainId,
        generation: first.generation,
        attemptId: first.attemptId,
        credential: encryptedCredential("old-secret"),
      })
    ).rejects.toThrow("superseded")
    await client.mutation(api.pluginDomains.finalizeCredentialChange, {
      id: domainId,
      generation: second.generation,
      attemptId: second.attemptId,
      credential: encryptedCredential("new-secret"),
    })
    await client.mutation(api.pluginDomains.finalizeCredentialChange, {
      id: domainId,
      generation: second.generation,
      attemptId: second.attemptId,
      credential: encryptedCredential("duplicate-with-different-output"),
    })

    const credentials = await convex.run((context) =>
      context.db.query("userPluginCredentials").collect()
    )
    expect(credentials).toHaveLength(1)
    expect(credentials[0]?.ciphertext).toBe("new-secret")
  })

  it("prevents an in-flight finalizer from undoing deletion", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "domain-delete-user")
    const client = asAuthenticatedUser(convex, user.userId, user.sessionId)
    const domainId = await client.mutation(api.pluginDomains.create, {
      domain: "private.example",
      pluginServerId: "server-one",
      pluginId: "plugin-one",
      credential: encryptedCredential("initial-secret"),
    })
    const attempt = await client.mutation(
      api.pluginDomains.beginCredentialChange,
      { id: domainId }
    )
    await client.mutation(api.pluginDomains.deleteCredential, { id: domainId })

    await expect(
      client.mutation(api.pluginDomains.finalizeCredentialChange, {
        id: domainId,
        generation: attempt.generation,
        attemptId: attempt.attemptId,
        credential: encryptedCredential("resurrected-secret"),
      })
    ).rejects.toThrow("superseded")
    const credentials = await convex.run((context) =>
      context.db.query("userPluginCredentials").collect()
    )
    expect(credentials).toEqual([])
  })
})
