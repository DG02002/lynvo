// @vitest-environment edge-runtime

import { ExternalWorkerCredentialVault } from "../workers/external-worker-credential-vault"

const TEST_MASTER_KEY = btoa("0123456789abcdef0123456789abcdef")

const createState = (): DurableObjectState =>
  ({}) as DurableObjectState

const request = (path: string, body: Record<string, unknown>) =>
  new Request(`https://credential-vault.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("ExternalWorkerCredentialVault HTTP behavior", () => {
  it("encrypts a credential without returning plaintext and decrypts it in the same context", async () => {
    const vault = new ExternalWorkerCredentialVault(createState(), {
      PLUGIN_CREDENTIAL_MASTER_KEY: TEST_MASTER_KEY,
    } as Env)

    const encryptedResponse = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        workerId: "worker-1",
        apiKey: "external-worker-key",
      })
    )
    expect(encryptedResponse.status).toBe(200)
    const encrypted = await encryptedResponse.json<Record<string, unknown>>()
    expect(encrypted).not.toHaveProperty("apiKey")
    expect(encrypted.ciphertext).not.toBe("external-worker-key")

    const decryptedResponse = await vault.fetch(
      request("/decrypt", {
        userId: "user-1",
        workerId: "worker-1",
        credential: encrypted,
      })
    )
    expect(decryptedResponse.status).toBe(200)
    await expect(decryptedResponse.json()).resolves.toEqual({
      apiKey: "external-worker-key",
    })
  })

  it("rejects copied ciphertext in a different user or worker context", async () => {
    const vault = new ExternalWorkerCredentialVault(createState(), {
      PLUGIN_CREDENTIAL_MASTER_KEY: TEST_MASTER_KEY,
    } as Env)
    const encryptedResponse = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        workerId: "worker-1",
        apiKey: "external-worker-key",
      })
    )
    const credential = await encryptedResponse.json()

    const copiedResponse = await vault.fetch(
      request("/decrypt", {
        userId: "user-1",
        workerId: "worker-2",
        credential,
      })
    )
    expect(copiedResponse.status).toBe(422)
  })

  it("fails closed when the production master key is unavailable", async () => {
    const vault = new ExternalWorkerCredentialVault(createState(), {} as Env)
    const response = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        workerId: "worker-1",
        apiKey: "external-worker-key",
      })
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Credential protection is unavailable.",
    })
  })
})
