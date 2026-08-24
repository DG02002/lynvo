// @vitest-environment edge-runtime

import { PluginServerCredentialVault } from "../workers/plugin-server-credential-vault"

declare global {
  interface EncryptedCredentialTestResponse {
    readonly ciphertext: string
    readonly nonce: string
    readonly algorithm: string
    readonly keyVersion: number
  }
}

const TEST_ENCRYPTION_KEY = btoa("0123456789abcdef0123456789abcdef")

// SAFETY: The vault constructor does not read Durable Object state in these direct fetch tests.
const createState = (): DurableObjectState => ({}) as DurableObjectState

const request = <Body>(path: string, body: Body) =>
  new Request(`https://credential-vault.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("PluginServerCredentialVault HTTP behavior", () => {
  it("encrypts a credential without returning plaintext and decrypts it in the same context", async () => {
    // SAFETY: The vault only reads the encryption-key binding supplied by this test.
    const vault = new PluginServerCredentialVault(createState(), {
      PLUGIN_CREDENTIAL_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    } as Env)

    const encryptedResponse = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        pluginServerId: "plugin-server-1",
        apiKey: "plugin-server-key",
      })
    )
    expect(encryptedResponse.status).toBe(200)
    const encrypted =
      await encryptedResponse.json<EncryptedCredentialTestResponse>()
    expect(encrypted).not.toHaveProperty("apiKey")
    expect(encrypted.ciphertext).not.toBe("plugin-server-key")

    const decryptedResponse = await vault.fetch(
      request("/decrypt", {
        userId: "user-1",
        pluginServerId: "plugin-server-1",
        credential: encrypted,
      })
    )
    expect(decryptedResponse.status).toBe(200)
    await expect(decryptedResponse.json()).resolves.toEqual({
      apiKey: "plugin-server-key",
    })
  })

  it("rejects copied ciphertext in a different user or Plugin Server context", async () => {
    // SAFETY: The vault only reads the encryption-key binding supplied by this test.
    const vault = new PluginServerCredentialVault(createState(), {
      PLUGIN_CREDENTIAL_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    } as Env)
    const encryptedResponse = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        pluginServerId: "plugin-server-1",
        apiKey: "plugin-server-key",
      })
    )
    const credential = await encryptedResponse.json()

    const copiedResponse = await vault.fetch(
      request("/decrypt", {
        userId: "user-1",
        pluginServerId: "plugin-server-2",
        credential,
      })
    )
    expect(copiedResponse.status).toBe(422)
  })

  it("fails closed when the production encryption key is unavailable", async () => {
    // SAFETY: The missing encryption-key binding is the failure case under test.
    const environment = {} as Env
    const vault = new PluginServerCredentialVault(createState(), environment)
    const response = await vault.fetch(
      request("/encrypt", {
        userId: "user-1",
        pluginServerId: "plugin-server-1",
        apiKey: "plugin-server-key",
      })
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Credential protection is unavailable.",
    })
  })
})
