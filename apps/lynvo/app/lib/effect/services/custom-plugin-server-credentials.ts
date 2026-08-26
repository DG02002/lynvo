import { Effect, Schema } from "effect"
import { CredentialVaultError } from "../errors"
import type { JsonValue } from "@dg02002/lynvo-plugin-server-protocol"

export interface EncryptedCustomPluginServerCredential {
  readonly apiKeyCiphertext: string
  readonly apiKeyNonce: string
  readonly apiKeyAlgorithm: "AES-256-GCM"
  readonly apiKeyVersion: number
}

interface StoredCustomPluginServerCredential {
  readonly id: string
  readonly apiKeyCiphertext?: string
  readonly apiKeyNonce?: string
  readonly apiKeyAlgorithm?: "AES-256-GCM"
  readonly apiKeyVersion?: number
  readonly proxyTokenCiphertext?: string | null
  readonly proxyTokenNonce?: string | null
  readonly proxyTokenAlgorithm?: "AES-256-GCM" | null
  readonly proxyTokenVersion?: number | null
}

const EncryptedResponse = Schema.Struct({
  ciphertext: Schema.String,
  nonce: Schema.String,
  algorithm: Schema.Literal("AES-256-GCM"),
  keyVersion: Schema.Number,
})

const DecryptedResponse = Schema.Struct({ apiKey: Schema.String })

const vaultRequest = Effect.fn("CustomPluginServerCredentials.vaultRequest")(
  function* (
    environment: Env,
    userId: string,
    pluginServerId: string,
    path: "/encrypt" | "/decrypt",
    body: Record<string, JsonValue>
  ): Effect.fn.Return<JsonValue, CredentialVaultError> {
    const response = yield* Effect.tryPromise({
      try: () =>
        environment.PLUGIN_SERVER_CREDENTIAL_VAULT.getByName(
          `${userId}:${pluginServerId}`
        ).fetch(`https://credential-vault.internal${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, pluginServerId, ...body }),
        }),
      catch: (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential protection is unavailable",
          cause,
        }),
    })
    if (!response.ok) {
      return yield* new CredentialVaultError({
        message: "External pluginServer credential protection is unavailable",
      })
    }
    const payload = yield* Effect.tryPromise({
      try: async () => {
        const json = await response.json()
        // SAFETY: Parsed JSON from vault response is a JsonValue.
        return json as JsonValue
      },
      catch: (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        }),
    })
    return payload
  }
)

export const encryptCustomPluginServerApiKey = Effect.fn(
  "CustomPluginServerCredentials.encryptCustomPluginServerApiKey"
)(function* (
  environment: Env,
  userId: string,
  pluginServerId: string,
  apiKey: string
): Effect.fn.Return<
  EncryptedCustomPluginServerCredential,
  CredentialVaultError
> {
  const encrypted = yield* vaultRequest(
    environment,
    userId,
    pluginServerId,
    "/encrypt",
    { apiKey }
  )
  const decoded = yield* Schema.decodeUnknownEffect(EncryptedResponse)(
    encrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        })
    )
  )
  return {
    apiKeyCiphertext: decoded.ciphertext,
    apiKeyNonce: decoded.nonce,
    apiKeyAlgorithm: decoded.algorithm,
    apiKeyVersion: decoded.keyVersion,
  }
})

export const decryptCustomPluginServer = Effect.fn(
  "CustomPluginServerCredentials.decryptCustomPluginServer"
)(function* <PluginServer extends StoredCustomPluginServerCredential>(
  environment: Env,
  userId: string,
  pluginServer: PluginServer
): Effect.fn.Return<
  PluginServer & { readonly apiKey: string },
  CredentialVaultError
> {
  if (
    !pluginServer.apiKeyCiphertext ||
    !pluginServer.apiKeyNonce ||
    !pluginServer.apiKeyAlgorithm ||
    pluginServer.apiKeyVersion === undefined
  ) {
    return yield* new CredentialVaultError({
      message: "Custom Plugin Server credential record is incomplete",
    })
  }
  const decrypted = yield* vaultRequest(
    environment,
    userId,
    pluginServer.id,
    "/decrypt",
    {
      credential: {
        ciphertext: pluginServer.apiKeyCiphertext,
        nonce: pluginServer.apiKeyNonce,
        algorithm: pluginServer.apiKeyAlgorithm,
        keyVersion: pluginServer.apiKeyVersion,
      },
    }
  )
  const decoded = yield* Schema.decodeUnknownEffect(DecryptedResponse)(
    decrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "Custom Plugin Server credential response is invalid",
          cause,
        })
    )
  )
  return { ...pluginServer, apiKey: decoded.apiKey }
})

export const decryptCustomPluginServerProxyToken = Effect.fn(
  "CustomPluginServerCredentials.decryptCustomPluginServerProxyToken"
)(function* (
  environment: Env,
  userId: string,
  pluginServer: StoredCustomPluginServerCredential
): Effect.fn.Return<string | undefined, CredentialVaultError> {
  if (
    !pluginServer.proxyTokenCiphertext ||
    !pluginServer.proxyTokenNonce ||
    !pluginServer.proxyTokenAlgorithm ||
    pluginServer.proxyTokenVersion === undefined ||
    pluginServer.proxyTokenVersion === null
  ) {
    return undefined
  }
  const decrypted = yield* vaultRequest(
    environment,
    userId,
    pluginServer.id,
    "/decrypt",
    {
      credential: {
        ciphertext: pluginServer.proxyTokenCiphertext,
        nonce: pluginServer.proxyTokenNonce,
        algorithm: pluginServer.proxyTokenAlgorithm,
        keyVersion: pluginServer.proxyTokenVersion,
      },
    }
  )
  const decoded = yield* Schema.decodeUnknownEffect(DecryptedResponse)(
    decrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        })
    )
  )
  return decoded.apiKey
})

export const decryptCustomPluginServers = Effect.fn(
  "CustomPluginServerCredentials.decryptCustomPluginServers"
)(function* <PluginServer extends StoredCustomPluginServerCredential>(
  environment: Env,
  userId: string,
  pluginServers: ReadonlyArray<PluginServer>
) {
  return yield* Effect.forEach(
    pluginServers,
    (pluginServer) =>
      Effect.gen(function* () {
        const decrypted = yield* decryptCustomPluginServer(
          environment,
          userId,
          pluginServer
        )
        const proxyToken = yield* decryptCustomPluginServerProxyToken(
          environment,
          userId,
          pluginServer
        )
        return proxyToken === undefined
          ? decrypted
          : { ...decrypted, proxyToken }
      }),
    { concurrency: 8 }
  )
})
