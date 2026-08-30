import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import {
  normalizePluginDomain,
  parsePluginDomainInput,
  parsePluginDomainCandidate,
} from "~/lib/plugin-domain"
import {
  createPluginCredentialAdditionalData,
  PluginCredentialVault,
} from "~/lib/effect/services/plugin-credential-vault"
import { CloudflareEnv } from "~/lib/effect/services/cloudflare-env"
import { buildCredentialDocument } from "../workers/d1/plugin-domains"
import {
  parseHttpBasicCredential,
  serializeHttpBasicCredential,
} from "~/lib/plugins/http-basic-credential"

describe("Plugin Domain lifecycle", () => {
  it("normalizes duplicate domain spellings to one identity", () => {
    expect(normalizePluginDomain(" HTTPS://Example.COM./path ")).toBe(
      "example.com"
    )
    expect(normalizePluginDomain("example.com")).toBe("example.com")
  })

  it("accepts a Bhadoo Workers hostname", () => {
    expect(normalizePluginDomain("https://source-alpha.example/0:/")).toBe(
      "source-alpha.example"
    )
  })

  it("extracts encoded HTTP Basic Auth credentials from a domain URL", () => {
    expect(
      parsePluginDomainInput(
        "https://source-user:source%40secret@index.example.com/0:/"
      )
    ).toEqual({
      url: "https://index.example.com/0:/",
      username: "source-user",
      password: "source@secret",
    })
  })

  it("detects a Bhadoo index URL and removes credentials from its saved URL", () => {
    expect(
      parsePluginDomainCandidate(
        "https://source-user:source%40secret@index.example.com/0:/Movies/"
      )
    ).toEqual({
      domain: "index.example.com",
      sanitizedUrl: "https://index.example.com/0:/Movies/",
      username: "source-user",
      password: "source@secret",
    })
  })

  it("accepts any HTTPS source URL without classifying its implementation", () => {
    expect(parsePluginDomainCandidate("https://example.com/movies/")).toEqual({
      domain: "example.com",
      sanitizedUrl: "https://example.com/movies/",
    })
    expect(
      parsePluginDomainCandidate("http://example.com/0:/Movies/")
    ).toBeUndefined()
  })

  it("serializes an HTTP Basic Auth username and password for encryption", () => {
    const encryptedValue = serializeHttpBasicCredential(
      "source-user",
      "source@secret"
    )

    expect(parseHttpBasicCredential(encryptedValue)).toEqual({
      username: "source-user",
      password: "source@secret",
    })
  })

  it("builds Plugin Credentials from their owning Plugin Domain", () => {
    const credential = {
      ciphertext: "ciphertext",
      nonce: "nonce",
      algorithm: "AES-256-GCM" as const,
      keyVersion: 1,
    }
    const credentialDocument = buildCredentialDocument({
      userId: "user-1",
      domainRow: {
        id: "domain-1",
        user_id: "user-1",
        plugin_server_id: "plugin-server-1",
        plugin_id: "onedrive-index",
        domain: "example.com",
        credential_generation: 1,
        credential_attempt_id: null,
        credential_finalized_attempt_id: null,
      },
      credential,
      existingCredential: {
        id: "credential-1",
        user_id: "user-1",
        plugin_domain_id: "domain-1",
        plugin_server_id: "plugin-server-1",
        plugin_id: "onedrive-index",
        domain: "example.com",
        ciphertext: "old",
        nonce: "old",
        algorithm: "AES-256-GCM" as const,
        key_version: 1,
        created_at: 10,
        updated_at: 10,
      },
      now: 20,
    })

    expect(credentialDocument).toMatchObject({
      id: "credential-1",
      user_id: "user-1",
      plugin_domain_id: "domain-1",
      plugin_server_id: "plugin-server-1",
      plugin_id: "onedrive-index",
      domain: "example.com",
      ciphertext: "ciphertext",
      nonce: "nonce",
      algorithm: "AES-256-GCM",
      key_version: 1,
      created_at: 10,
      updated_at: 20,
    })
  })

  it("binds encryption context to owner, plugin, domain, and key version", () => {
    const context = {
      userId: "user-1",
      pluginServerId: "plugin-server-1",
      pluginId: "onedrive-index",
      domain: "example.com",
    }
    const encoder = new TextDecoder()

    expect(encoder.decode(createPluginCredentialAdditionalData(context))).toBe(
      "user-1\u0000plugin-server-1\u0000onedrive-index\u0000example.com\u00001"
    )
    expect(
      createPluginCredentialAdditionalData({ ...context, userId: "user-2" })
    ).not.toEqual(createPluginCredentialAdditionalData(context))
    expect(
      createPluginCredentialAdditionalData({
        ...context,
        pluginId: "different-plugin",
      })
    ).not.toEqual(createPluginCredentialAdditionalData(context))
  })

  it("decrypts only with the exact owning context", async () => {
    // SAFETY: The credential vault only reads the encryption-key binding supplied here.
    const environmentLayer = Layer.succeed(CloudflareEnv, {
      PLUGIN_CREDENTIAL_ENCRYPTION_KEY: btoa(
        "0123456789abcdef0123456789abcdef"
      ),
    } as Env)
    const vaultLayer = PluginCredentialVault.layer.pipe(
      Layer.provide(environmentLayer)
    )
    const context = {
      userId: "user-1",
      pluginServerId: "plugin-server-1",
      pluginId: "onedrive-index",
      domain: "example.com",
    }
    const program = Effect.gen(function* () {
      const vault = yield* PluginCredentialVault
      const encrypted = yield* vault.encrypt("server-only-password", context)
      const plaintext = yield* vault.decrypt(encrypted, context)
      return { plaintext, encrypted }
    }).pipe(Effect.provide(vaultLayer))

    const result = await Effect.runPromise(program)
    expect(result.plaintext).toBe("server-only-password")
    const wrongOwnerProgram = Effect.gen(function* () {
      const vault = yield* PluginCredentialVault
      return yield* vault.decrypt(result.encrypted, {
        ...context,
        userId: "user-2",
      })
    }).pipe(Effect.provide(vaultLayer))
    await expect(Effect.runPromise(wrongOwnerProgram)).rejects.toBeDefined()
  })
})
